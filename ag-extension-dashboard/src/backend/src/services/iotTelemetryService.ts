import { logger } from '../utils/logger';

export interface SoilProbeTelemetry {
  deviceId: string;
  sensorType: 'lorawan_dragino' | 'soil_moisture_capacitance' | 'micro_weather_station';
  batteryVoltage: number; // e.g. 3.6V
  soilVwcPct: number; // Volumetric Water Content % (0 - 100%)
  soilEcSalinityMsdPerCm: number; // Electrical Conductivity mS/cm
  soilTempC: number;
  airTempC: number;
  airHumidityPct: number;
  recordedAt: string;
}

export interface IrrigationDecision {
  deviceId: string;
  vpdKPa: number;
  transpirationStressLevel: 'low' | 'optimal' | 'high' | 'extreme_stress';
  soilMoistureStatus: 'saturated' | 'field_capacity' | 'drying_down' | 'wilting_point_risk';
  irrigationTriggered: boolean;
  recommendedWaterVolumeLitersPerHa: number;
  decisionReason: string;
}

/**
 * Calculates Saturated Vapor Pressure (SVP) in kPa using Tetens formula
 */
export function calculateSvpKPa(tempC: number): number {
  return 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/**
 * Calculates Vapor Pressure Deficit (VPD) in kPa
 * Formula: VPD = SVP * (1 - RH / 100)
 */
export function calculateVpdKPa(tempC: number, relativeHumidityPct: number): number {
  const svp = calculateSvpKPa(tempC);
  const rhRatio = Math.max(0, Math.min(100, relativeHumidityPct)) / 100;
  const vpd = svp * (1 - rhRatio);
  return +Math.max(0, vpd).toFixed(2);
}

/**
 * Evaluates soil moisture and VPD to trigger automated smart solar irrigation
 */
export function evaluateSmartIrrigation(telemetry: SoilProbeTelemetry): IrrigationDecision {
  logger.info(`Evaluating smart irrigation for IoT probe ${telemetry.deviceId} (VWC=${telemetry.soilVwcPct}%, Temp=${telemetry.airTempC}°C)`);

  const vpd = calculateVpdKPa(telemetry.airTempC, telemetry.airHumidityPct);

  let transpirationStress: IrrigationDecision['transpirationStressLevel'] = 'optimal';
  if (vpd < 0.4) transpirationStress = 'low';
  else if (vpd > 1.6) transpirationStress = 'extreme_stress';
  else if (vpd > 1.2) transpirationStress = 'high';

  let soilStatus: IrrigationDecision['soilMoistureStatus'] = 'field_capacity';
  let trigger = false;
  let recommendedWater = 0;
  let reason = 'Soil moisture is at optimal field capacity. No irrigation required.';

  // Agronomic VWC thresholds for loam/clay-loam soils
  if (telemetry.soilVwcPct > 38.0) {
    soilStatus = 'saturated';
    reason = 'Soil is saturated / waterlogged. Ensure field drainage to prevent root hypoxia.';
  } else if (telemetry.soilVwcPct < 18.0) {
    soilStatus = 'wilting_point_risk';
    trigger = true;
    recommendedWater = 28000; // ~28,000 L/ha (2.8mm water equivalent)
    reason = `CRITICAL: Soil moisture (${telemetry.soilVwcPct}%) has reached permanent wilting point. Immediate irrigation solenoid trigger activated.`;
  } else if (telemetry.soilVwcPct < 25.0) {
    soilStatus = 'drying_down';
    if (transpirationStress === 'high' || transpirationStress === 'extreme_stress') {
      trigger = true;
      recommendedWater = 18000;
      reason = `Soil moisture is depleting (${telemetry.soilVwcPct}%) under high atmospheric evaporative demand (VPD ${vpd} kPa). Scheduled solar pump pulse triggered.`;
    } else {
      reason = `Soil moisture is depleting (${telemetry.soilVwcPct}%) but low evaporative demand (VPD ${vpd} kPa) permits delayed irrigation.`;
    }
  }

  return {
    deviceId: telemetry.deviceId,
    vpdKPa: vpd,
    transpirationStressLevel: transpirationStress,
    soilMoistureStatus: soilStatus,
    irrigationTriggered: trigger,
    recommendedWaterVolumeLitersPerHa: recommendedWater,
    decisionReason: reason,
  };
}
