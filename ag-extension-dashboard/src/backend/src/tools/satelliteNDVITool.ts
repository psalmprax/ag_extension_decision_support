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
  description: 'Retrieves satellite vegetation indices (NDVI) and time series data for a geographic location. Use when analyzing crop health from space, monitoring vegetation changes, or assessing field conditions remotely.',
  schema: satelliteNDVISchema,
  execute: async ({ latitude, longitude, daysBack }) => {
    try {
      const [current, timeSeries, imagery] = await Promise.all([
        SatelliteService.getSpectralIndices(latitude, longitude),
        SatelliteService.getNDVITimeSeries(latitude, longitude, daysBack),
        SatelliteService.getImageryUrl(latitude, longitude),
      ]);

      const result = {
        location: { latitude, longitude },
        current: current[0] || null,
        timeSeries: timeSeries.slice(-12),
        imagery,
        interpretation: interpretNDVI(current[0]?.ndvi, timeSeries),
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

function interpretNDVI(current: number | undefined, series: Array<{ date: string; ndvi: number }>): string {
  if (current === undefined || current === null) return 'No NDVI data available';

  let interpretation = `Current NDVI: ${current.toFixed(3)} — `;
  if (current < 0.2) interpretation += 'bare soil or dead vegetation';
  else if (current < 0.4) interpretation += 'sparse or stressed vegetation';
  else if (current < 0.6) interpretation += 'moderate vegetation health';
  else interpretation += 'healthy, dense vegetation';

  if (series.length >= 2) {
    const recent = series.slice(-3);
    const trend = recent[recent.length - 1].ndvi - recent[0].ndvi;
    if (trend > 0.05) interpretation += '. Trend: improving vegetation.';
    else if (trend < -0.05) interpretation += '. Trend: declining vegetation — investigate stress factors.';
    else interpretation += '. Trend: stable.';
  }

  return interpretation;
}
