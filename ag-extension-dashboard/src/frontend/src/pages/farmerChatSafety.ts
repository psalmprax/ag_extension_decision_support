export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationMm?: number;
  relativeHumidityPct?: number;
  windSpeedKmh?: number;
}

export const defaultFollowUpQuestions = [
  'Which crop and growth stage are affected?',
  'When did the symptoms first appear?',
  'What have you observed in the field?',
];

export function parseFollowUpQuestions(text: string): string[] {
  return text.split('\n').map(line => line.replace(/^[\d\-*.\s]+/, '').trim())
    .filter(line => line.endsWith('?')).slice(0, 3);
}

export function buildHazardDays(forecast: WeatherForecastDay[]) {
  return forecast.slice(0, 3).flatMap(day => {
    const values = [day.minTemp, day.maxTemp, day.precipitationMm, day.relativeHumidityPct, day.windSpeedKmh];
    if (typeof day.date !== 'string' || !day.date.trim() ||
        !values.every(value => typeof value === 'number' && Number.isFinite(value))) return [];
    return [{
      date: day.date, minTempC: day.minTemp, maxTempC: day.maxTemp,
      precipitationMm: day.precipitationMm, relativeHumidityPct: day.relativeHumidityPct, windSpeedKmh: day.windSpeedKmh,
    }];
  });
}
import type { FarmerSoilProfile } from '@/api/soilService';

export interface PlotTelemetry {
  conversationId: string | null;
  ph: number | null;
  soc: number | null;
  moisture: number | null;
  temp: number | null;
  loading: boolean;
}

export function toPlotTelemetry(conversationId: string, profile: FarmerSoilProfile): PlotTelemetry {
  const moisture = profile.moisture?.soilMoisture.avgTop9cm;
  return {
    conversationId,
    ph: profile.baseline?.ph ?? null,
    soc: profile.baseline?.organicCarbonGPerKg ?? null,
    moisture: moisture == null ? null : Number((moisture * 100).toFixed(1)),
    temp: profile.moisture?.soilTemperature.avgTop6cm ?? null,
    loading: false,
  };
}
