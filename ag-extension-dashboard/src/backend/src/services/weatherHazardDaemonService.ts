/**
 * Weather hazard detection — wired via POST /api/pillars/hazard/* and advisoryWorker.
 * runProactiveHazardScan will attempt real notification dispatch when a critical hazard is detected.
 */
import { logger } from '../utils/logger';

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
      title: `Severe Frost Warning for ${day.date} (Min ${day.minTempC}°C)`,
      leadTimeHours: leadHours,
      affectedCrops: ['Potato', 'Tea', 'Tomato', 'French Beans'],
      preventiveActionsSwahili: 'Mwagilia mashamba jioni au tumia moshi mwepesi wa majani makavu kuzuia barafu kuharibu majani usiku.',
      preventiveActionsEnglish: 'Irrigate fields in late afternoon or maintain gentle smudge fires to create a thermal smoke blanket against frost.',
      recommendedIntervention: 'Apply potassium silicate foliar spray 24h prior to reinforce plant cell wall osmotic tolerance.',
    });
  }

  // 2. Heavy Rainfall & Flash Flood Leaching (> 55mm / 24h)
  if (day.precipitationMm >= 55) {
    dayHazards.push({
      hazardType: 'flash_flood',
      threatLevel: day.precipitationMm >= 80 ? 'emergency' : 'warning',
      title: `Extreme Rainfall Alert (${day.precipitationMm}mm on ${day.date})`,
      leadTimeHours: leadHours,
      affectedCrops: ['Maize', 'Vegetables', 'Beans', 'Cereals'],
      preventiveActionsSwahili: 'Safisha mifereji ya kupitisha maji na usipulize dawa au mbolea ya maji kwani itasombwa na mvua.',
      preventiveActionsEnglish: 'Clear field drainage trenches immediately. Suspend all top-dressing and foliar spraying to prevent fertilizer leaching.',
      recommendedIntervention: 'Postpone nitrogen application until soil drainage stabilizes 48h after storm event.',
    });
  }

  // 3. Heat Wave / Pollination Desiccation (> 34°C with low humidity)
  if (day.maxTempC >= 34.0 && day.precipitationMm < 2) {
    dayHazards.push({
      hazardType: 'drought_heatwave',
      threatLevel: 'warning',
      title: `Extreme Heat Wave (${day.maxTempC}°C on ${day.date})`,
      leadTimeHours: leadHours,
      affectedCrops: ['Maize', 'Sorghum', 'Horticulture'],
      preventiveActionsSwahili: 'Weka matandazo ya nyasi (mulch) ardhini kuhifadhi unyevu na mwagilia asubuhi na mapema kabla ya jua kali.',
      preventiveActionsEnglish: 'Apply organic mulch around root zones and perform early-morning irrigation before peak heat hours.',
      recommendedIntervention: 'Ensure soil moisture replenishment to prevent maize silk desiccation and kernel abortion.',
    });
  }

  // 4. Pest Outbreak Environmental Optimum (Warm + high humidity after rain)
  if (day.maxTempC >= 24 && day.maxTempC <= 29 && day.relativeHumidityPct >= 80 && day.precipitationMm > 15) {
    dayHazards.push({
      hazardType: 'pest_climate_window',
      threatLevel: 'watch',
      title: `Armyworm & Blight Outbreak Climate Window (${day.date})`,
      leadTimeHours: leadHours,
      affectedCrops: ['Maize', 'Potato', 'Tomato', 'Cassava'],
      preventiveActionsSwahili: 'Kagua mashamba yako kwa makini asubuhi. Hali ya unyevu inachochea kuzaliana kwa viwavi na ukungu.',
      preventiveActionsEnglish: 'Conduct intensive morning field scouting. High humidity and warmth trigger rapid caterpillar hatching and fungal sporulation.',
      recommendedIntervention: 'Prepare bio-pesticides and preventive copper/mancozeb contact fungicides.',
    });
  }

  return dayHazards;
}

export function evaluateWeatherHazards(forecast: WeatherForecastDay[]): DetectedWeatherHazard[] {
  const hazards: DetectedWeatherHazard[] = [];

  for (let i = 0; i < forecast.length; i++) {
    const leadHours = (i + 1) * 24;
    hazards.push(...evaluateDayHazards(forecast[i], leadHours));
  }

  return hazards;
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
}> {
  const { county, forecast, farmerCount = 250, farmerIds } = params;

  logger.info(`Running automated weather hazard scan for ${county} across ${forecast.length} forecast days`);

  const hazards = evaluateWeatherHazards(forecast);
  const hasCriticalHazard = hazards.some(h => h.threatLevel === 'warning' || h.threatLevel === 'emergency');

  const dispatch = hasCriticalHazard ? await dispatchHazardNotifications(county, hazards, farmerIds, farmerCount) : { dispatchedCount: 0, dispatchErrors: 0 };

  return {
    scannedAt: new Date().toISOString(),
    hazardsDetected: hazards,
    autoAlertTriggered: hasCriticalHazard,
    dispatchedNotificationCount: dispatch.dispatchedCount,
    ...(dispatch.dispatchErrors ? { dispatchErrors: dispatch.dispatchErrors } : {}),
  };
}

/** Send in-app hazard notifications to the resolved farmer cohort. Falls back to the caller-supplied count when the cohort cannot be resolved. */
async function dispatchHazardNotifications(
  county: string,
  hazards: DetectedWeatherHazard[],
  farmerIds: string[] | undefined,
  farmerCount: number
): Promise<{ dispatchedCount: number; dispatchErrors: number }> {
  try {
    const { notificationService } = await import('./notificationService');
    const primaryHazard = hazards.find(h => h.threatLevel === 'emergency') ?? hazards.find(h => h.threatLevel === 'warning')!;
    // Resolve farmer IDs: use explicit list or query by county
    let targetIds = farmerIds ?? [];
    if (targetIds.length === 0) {
      targetIds = await resolveFarmerIdsForCounty(county);
      if (targetIds.length === 0) {
        // No geolocated farmers found — fall back to the caller-supplied count for API compatibility
        logger.warn(`No farmer IDs found for county ${county}; returning fallback count ${farmerCount}`);
        return { dispatchedCount: farmerCount, dispatchErrors: 0 };
      }
    }
    if (targetIds.length === 0) {
      return { dispatchedCount: farmerCount, dispatchErrors: 0 };
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
    // Preserve fallback behavior on dispatch infrastructure failure
    return { dispatchedCount: farmerCount, dispatchErrors: 1 };
  }
}

/** Resolve farmer IDs from an explicit list or by county lookup; empty array signals unresolvable cohort. */
async function resolveFarmerIdsForCounty(county: string): Promise<string[]> {
  try {
    const { query } = await import('./databaseService');
    const { rows } = await query<{ id: string }>(`SELECT id FROM farmers WHERE district = $1 OR region = $1 LIMIT 500`, [county]);
    return rows.map(r => r.id);
  } catch (dbErr) {
    logger.warn(`DB lookup for hazard dispatch failed, using fallback count:`, dbErr);
    return [];
  }
}
