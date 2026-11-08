/**
 * Weather hazard detection — wired via POST /api/pillars/hazard/* and advisoryWorker.
 * runProactiveHazardScan will attempt real notification dispatch when a critical hazard is detected.
 *
 * Hazards are threshold rules over caller-supplied forecasts (deterministic_estimation);
 * no live weather feed is ingested here. Responses carry a `provenance` block.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface WeatherForecastDay {
  date: string;
  minTempC: number;
  maxTempC: number;
  precipitationMm: number;
  relativeHumidityPct: number;
  windSpeedKmh: number;
}

export interface DetectedWeatherHazard {
  hazardType: 'frost' | 'flash_flood' | 'drought_heatwave' | 'pest_climate_window' | 'high_wind';
  threatLevel: 'advisory' | 'watch' | 'warning' | 'emergency';
  title: string;
  leadTimeHours: number;
  affectedCrops: string[];
  preventiveActionsSwahili: string;
  preventiveActionsEnglish: string;
  recommendedIntervention: string;
}

function evaluateDayHazards(day: WeatherForecastDay, leadHours: number): DetectedWeatherHazard[] {
  const dayHazards: DetectedWeatherHazard[] = [];

  // 1. Frost Warning (Night temp < 4°C)
  if (day.minTempC <= 3.5) {
    dayHazards.push({
      hazardType: 'frost',
      threatLevel: day.minTempC <= 1.0 ? 'warning' : 'watch',
      title: `Low-temperature threshold reached for ${day.date} (Min ${day.minTempC}°C)`,
      leadTimeHours: leadHours,
      affectedCrops: ['Potato', 'Tea', 'Tomato', 'French Beans'],
      preventiveActionsSwahili: 'Fuatilia utabiri wa eneo lako na wasiliana na afisa ugani kuhusu hatari ya baridi.',
      preventiveActionsEnglish: 'Check the local forecast and consult an extension officer about frost risk.',
      recommendedIntervention: 'Seek locally appropriate guidance before choosing a protective action.',
    });
  }

  // 2. Heavy Rainfall & Flash Flood Leaching (> 55mm / 24h)
  if (day.precipitationMm >= 55) {
    dayHazards.push({
      hazardType: 'flash_flood',
      threatLevel: day.precipitationMm >= 80 ? 'emergency' : 'warning',
      title: `High rainfall threshold reached (${day.precipitationMm}mm on ${day.date})`,
      leadTimeHours: leadHours,
      affectedCrops: ['Maize', 'Vegetables', 'Beans', 'Cereals'],
      preventiveActionsSwahili: 'Fuatilia tahadhari za mafuriko na epuka maeneo yenye maji mengi.',
      preventiveActionsEnglish: 'Monitor local flood alerts and avoid flooded or unstable areas.',
      recommendedIntervention: 'Consult local guidance before field work or crop applications.',
    });
  }

  // 3. Heat Wave / Pollination Desiccation (> 34°C with low humidity)
  if (day.maxTempC >= 34.0 && day.precipitationMm < 2) {
    dayHazards.push({
      hazardType: 'drought_heatwave',
      threatLevel: 'warning',
      title: `High temperature threshold reached (${day.maxTempC}°C on ${day.date})`,
      leadTimeHours: leadHours,
      affectedCrops: ['Maize', 'Sorghum', 'Horticulture'],
      preventiveActionsSwahili: 'Fuatilia tahadhari za joto na hali ya mazao, na wasiliana na afisa ugani.',
      preventiveActionsEnglish: 'Monitor local heat alerts and crop conditions.',
      recommendedIntervention: 'Consult an extension officer about locally appropriate water management.',
    });
  }

  // 4. Pest Outbreak Environmental Optimum (Warm + high humidity after rain)
  if (day.maxTempC >= 24 && day.maxTempC <= 29 && day.relativeHumidityPct >= 80 && day.precipitationMm > 15) {
    dayHazards.push({
      hazardType: 'pest_climate_window',
      threatLevel: 'watch',
      title: `Warm and humid weather threshold reached (${day.date})`,
      leadTimeHours: leadHours,
      affectedCrops: ['Maize', 'Potato', 'Tomato', 'Cassava'],
      preventiveActionsSwahili: 'Kagua mimea na wasiliana na afisa ugani ukiona dalili zisizo za kawaida.',
      preventiveActionsEnglish: 'Scout crops for unusual symptoms; weather alone does not confirm an outbreak.',
      recommendedIntervention: 'Seek local diagnosis and guidance before selecting any treatment.',
    });
  }

  return dayHazards;
}

export interface HazardEvaluationResult {
  hazards: DetectedWeatherHazard[];
  provenance: ReturnType<typeof pillarProvenance>;
}

export function evaluateWeatherHazards(forecast: WeatherForecastDay[]): DetectedWeatherHazard[] {
  const hazards: DetectedWeatherHazard[] = [];

  for (let i = 0; i < forecast.length; i++) {
    const leadHours = (i + 1) * 24;
    hazards.push(...evaluateDayHazards(forecast[i], leadHours));
  }

  return hazards;
}

/** Threshold-rule hazard evaluation over the caller-supplied forecast, with provenance. */
export function evaluateWeatherHazardsWithProvenance(forecast: WeatherForecastDay[]): HazardEvaluationResult {
  return {
    hazards: evaluateWeatherHazards(forecast),
    provenance: pillarProvenance(
      'deterministic_estimation',
      'Hazards are fixed threshold rules (frost <= 3.5°C, rain >= 55mm/24h, heat >= 34°C dry, pest window 24-29°C & RH >= 80% & rain > 15mm) applied to the caller-supplied forecast. No live weather feed is ingested by this service.',
      ['Thresholds are unvalidated estimates, not official alerts or outbreak diagnoses; lead time assumes 24h per forecast day index'],
      false
    ),
  };
}

export async function runProactiveHazardScan(params: {
  county: string;
  forecast: WeatherForecastDay[];
  farmerCount?: number;
  /** Optional explicit farmer IDs to notify; if omitted, all farmers in county are queried. */
  farmerIds?: string[];
}): Promise<{
  scannedAt: string;
  hazardsDetected: DetectedWeatherHazard[];
  autoAlertTriggered: boolean;
  dispatchedNotificationCount: number;
  dispatchErrors?: number;
  provenance: ReturnType<typeof pillarProvenance>;
}> {
  const { county, forecast, farmerIds } = params;

  logger.info(`Running automated weather hazard scan for ${county} across ${forecast.length} forecast days`);

  const hazards = evaluateWeatherHazards(forecast);
  const hasCriticalHazard = hazards.some(h => h.threatLevel === 'warning' || h.threatLevel === 'emergency');

  const dispatch = hasCriticalHazard ? await dispatchHazardNotifications(county, hazards, farmerIds) : { dispatchedCount: 0, dispatchErrors: 0 };

  return {
    scannedAt: new Date().toISOString(),
    hazardsDetected: hazards,
    autoAlertTriggered: dispatch.dispatchedCount > 0,
    dispatchedNotificationCount: dispatch.dispatchedCount,
    ...(dispatch.dispatchErrors ? { dispatchErrors: dispatch.dispatchErrors } : {}),
    provenance: evaluateWeatherHazardsWithProvenance(forecast).provenance,
  };
}

/** Send in-app hazard notifications to the resolved farmer cohort. */
async function dispatchHazardNotifications(
  county: string,
  hazards: DetectedWeatherHazard[],
  farmerIds: string[] | undefined
): Promise<{ dispatchedCount: number; dispatchErrors: number }> {
  try {
    const { notificationService } = await import('./notificationService');
    const primaryHazard = hazards.find(h => h.threatLevel === 'emergency') ?? hazards.find(h => h.threatLevel === 'warning')!;
    const targetIds = await resolveFarmerUserIds(county, farmerIds);
    if (targetIds.length === 0) {
      logger.warn(`No notification recipients found for county ${county}`);
      return { dispatchedCount: 0, dispatchErrors: 0 };
    }
    const results = await Promise.allSettled(
      targetIds.map(fid =>
        notificationService.send({
          userId: fid,
          type: 'warning' as const,
          title: primaryHazard.title,
          message: `${primaryHazard.preventiveActionsEnglish} — County: ${county}. Recommended: ${primaryHazard.recommendedIntervention}`,
          channel: 'in_app' as const,
          metadata: { county, hazardType: primaryHazard.hazardType, threatLevel: primaryHazard.threatLevel },
        })
      )
    );
    const dispatchedCount = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value).length;
    const dispatchErrors = results.length - dispatchedCount;
    logger.warn(`Hazard dispatch for ${county}: ${dispatchedCount} sent, ${dispatchErrors} failed of ${targetIds.length} targets`);
    return { dispatchedCount, dispatchErrors };
  } catch (dispatchErr) {
    logger.error(`Hazard notification dispatch failed for ${county}:`, dispatchErr);
    return { dispatchedCount: 0, dispatchErrors: 1 };
  }
}

/** Resolve notification user IDs by county; propagate database failures to the dispatch result. */
async function resolveFarmerUserIds(county: string, farmerIds?: string[]): Promise<string[]> {
  const { query } = await import('./databaseService');
  const { rows } = await query<{ id: string }>(
    `SELECT DISTINCT user_id AS id FROM farmers WHERE (district = $1 OR region = $1)
     AND user_id IS NOT NULL AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[])) LIMIT 500`,
    [county, farmerIds ?? null]
  );
  return rows.map(r => r.id);
}
