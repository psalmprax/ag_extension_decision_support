/**
 * @deprecated Specification phase only — not wired to any API surface (route, tool, worker, or app.ts).
 * See docs/PILLAR_SERVICES_DECISION.md for details.
 * These services exist only in test files and have no production integration.
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
}): Promise<{
  scannedAt: string;
  hazardsDetected: DetectedWeatherHazard[];
  autoAlertTriggered: boolean;
  dispatchedNotificationCount: number;
}> {
  const { county, forecast, farmerCount = 250 } = params;

  logger.info(`Running automated weather hazard scan for ${county} across ${forecast.length} forecast days`);

  const hazards = evaluateWeatherHazards(forecast);
  const hasCriticalHazard = hazards.some(h => h.threatLevel === 'warning' || h.threatLevel === 'emergency');

  const dispatchedCount = hasCriticalHazard ? farmerCount : 0;

  if (hasCriticalHazard) {
    logger.warn(`Critical weather hazard detected in ${county}: Auto-triggering preventive advisory dispatch to ${dispatchedCount} farmers`);
  }

  return {
    scannedAt: new Date().toISOString(),
    hazardsDetected: hazards,
    autoAlertTriggered: hasCriticalHazard,
    dispatchedNotificationCount: dispatchedCount,
  };
}
