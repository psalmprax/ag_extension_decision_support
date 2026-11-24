import { z } from 'zod';
import { Tool } from './types';
import { SatelliteService } from '@/services/satelliteService';

const satelliteNDVISchema = z.object({
  latitude: z.number().describe('Latitude coordinate'),
  longitude: z.number().describe('Longitude coordinate'),
  daysBack: z.number().optional().default(90).describe('Days of historical data to retrieve'),
});

export const satelliteNDVITool: Tool<typeof satelliteNDVISchema> = {
  name: 'satellite_ndvi_analysis',
  description: 'Returns satellite spectral indices (NDVI) when Sentinel Hub is configured, and the daily rain and mean temperature NASA POWER measured at the point. Rain and temperature are weather, not a measure of the crop: never present them as vegetation health, disease, pests or field-level stress.',
  schema: satelliteNDVISchema,
  execute: async ({ latitude, longitude, daysBack }) => {
    try {
      const [current, timeSeries, imagery] = await Promise.all([
        SatelliteService.getSpectralIndices(latitude, longitude),
        SatelliteService.getDailyWeather(latitude, longitude, Math.min(daysBack, 30)),
        SatelliteService.getImageryUrl(latitude, longitude),
      ]);

      const result = {
        location: { latitude, longitude },
        current: current[0] || null,
        recentWeather: timeSeries.data,
        recentWeatherStatus: timeSeries.dataStatus,
        recentWeatherSource: 'NASA POWER daily rain (mm) and mean air temperature (°C)',
        imagery,
        interpretation: interpret(current[0]?.ndvi, timeSeries.data),
        currentStatus: current[0] ? 'live_satellite' : 'unavailable',
        generatedAt: new Date().toISOString(),
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Satellite analysis failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/** Says what was measured, with no bands of the app's own for what an NDVI value means for a crop. */
function interpret(current: number | undefined, weather: Array<{ date: string; rainMm: number; tempC: number }>): string {
  const ndvi = current === undefined || current === null
    ? 'No satellite NDVI for this point (Sentinel Hub not configured or no clear scene).'
    : `Satellite NDVI: ${current.toFixed(3)}. Compare it with earlier scenes of the same field rather than with a fixed scale.`;
  if (weather.length === 0) return `${ndvi} No NASA POWER weather for these days.`;
  const rain = weather.reduce((sum, day) => sum + day.rainMm, 0);
  const temps = weather.map(day => day.tempC);
  return `${ndvi} NASA POWER, last ${weather.length} days: ${Math.round(rain * 10) / 10} mm of rain, daily mean temperature ${Math.min(...temps)}–${Math.max(...temps)} °C.`;
}
