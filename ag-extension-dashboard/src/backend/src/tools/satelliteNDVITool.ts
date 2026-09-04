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
  description: 'Returns satellite spectral indices when Sentinel Hub is configured, plus a *climate-derived vegetation vigor proxy* time series (NOT satellite NDVI) from NASA POWER temperature/precipitation. Always tell the user which of the two you are quoting; the proxy cannot detect disease, pests or field-level stress.',
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
        timeSeries: timeSeries.data.slice(-12),
        timeSeriesStatus: timeSeries.dataStatus,
        timeSeriesType: 'estimated_vegetation_vigor_proxy',
        timeSeriesReason: timeSeries.reason,
        imagery,
        interpretation: interpretNDVI(current[0]?.ndvi, timeSeries.data, timeSeries.dataStatus),
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

function interpretNDVI(
  current: number | undefined,
  series: Array<{ date: string; vigor: number }>,
  seriesStatus: 'estimated' | 'unavailable'
): string {
  const proxyNote = seriesStatus === 'estimated'
    ? ' (trend is a climate-derived vigor proxy from NASA POWER, not satellite NDVI)'
    : '';
  if (current === undefined || current === null) {
    return interpretMissingNDVI(series, seriesStatus, proxyNote);
  }
  return interpretCurrentNDVI(current, series, proxyNote);
}

function interpretMissingNDVI(
  series: Array<{ date: string; vigor: number }>,
  seriesStatus: 'estimated' | 'unavailable',
  proxyNote: string
): string {
  if (series.length >= 2 && seriesStatus === 'estimated') {
    const recent = series.slice(-3);
    const trend = recent[recent.length - 1].vigor - recent[0].vigor;
    const dir = trend > 0.05 ? 'improving' : trend < -0.05 ? 'declining' : 'stable';
    return `No live satellite NDVI available. Climate-derived vegetation vigor proxy trend: ${dir}${proxyNote}.`;
  }
  return 'No NDVI data available (Sentinel Hub not configured or returned no scene; climate proxy unavailable).';
}

function interpretCurrentNDVI(
  current: number,
  series: Array<{ date: string; vigor: number }>,
  proxyNote: string
): string {
  let interpretation = `Current NDVI (satellite): ${current.toFixed(3)} — `;
  interpretation += categorizeNDVI(current);

  if (series.length >= 2) {
    const recent = series.slice(-3);
    const trend = recent[recent.length - 1].vigor - recent[0].vigor;
    interpretation += getTrendMessage(trend, proxyNote);
  }

  return interpretation;
}

function categorizeNDVI(current: number): string {
  if (current < 0.2) return 'bare soil or dead vegetation';
  if (current < 0.4) return 'sparse or stressed vegetation';
  if (current < 0.6) return 'moderate vegetation health';
  return 'healthy, dense vegetation';
}

function getTrendMessage(trend: number, proxyNote: string): string {
  if (trend > 0.05) return `. Proxy trend: improving${proxyNote}.`;
  if (trend < -0.05) return `. Proxy trend: declining — verify with field scouting${proxyNote}.`;
  return `. Proxy trend: stable${proxyNote}.`;
}
