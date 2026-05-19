/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Tool } from './types';
import { nasaPowerService } from '../services/data/nasaPowerService';
import { logger } from '@/utils/logger';

const NasaPowerSchema = z.object({
  latitude: z.number().describe('The latitude coordinate of the farm/region'),
  longitude: z.number().describe('The longitude coordinate of the farm/region'),
  days: z.number().optional().default(7).describe('Number of past days to analyze (max 30)'),
});

/**
 * A tool that fetches historical and current meteorological data from NASA POWER API.
 */
export const nasaPowerTool: Tool<typeof NasaPowerSchema> = {
  name: 'get_geospatial_weather',
  description: 'Fetches highly accurate meteorological data (temperature, solar irradiance, soil moisture indicators) for a precise latitude/longitude from NASA POWER. Use this for drought risk, pest modeling, and precision agriculture advice.',
  schema: NasaPowerSchema,
  execute: async ({ latitude, longitude, days }) => {
    logger.info(`Fetching NASA POWER data for lat: ${latitude}, lng: ${longitude}`);

    try {
      const end = new Date();
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - Math.min(days, 30));

      const formatString = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');

      const data = await nasaPowerService.fetchMeteorologicalData({
        latitude,
        longitude,
        start: formatString(start),
        end: formatString(end)
      });

      // Process and summarize data for the LLM
      if (data && data.properties && data.properties.parameter) {
          const params = data.properties.parameter;
          const result = {
              source: "NASA POWER API (Agroclimatology)",
              location: { latitude, longitude },
              elevation: data.geometry?.coordinates?.[2] || "Unknown",
              period: `${formatString(start)} to ${formatString(end)}`,
              metrics: {
                  avg_temp_C: calculateAverage(params.T2M),
                  max_temp_C: calculateMax(params.T2M_MAX),
                  min_temp_C: calculateMin(params.T2M_MIN),
                  total_precipitation_mm: calculateSum(params.PRECTOTCORR),
                  avg_solar_irradiance: calculateAverage(params.ALLSKY_SFC_SW_DWN),
                  avg_profile_soil_moisture: calculateAverage(params.GWETPROF)
              }
          };
          return JSON.stringify(result);
      }
      
      return JSON.stringify({ error: "No data returned from NASA POWER for these coordinates." });
    } catch (error: any) {
      logger.error(`NASA POWER Tool failed:`, error);
      throw new Error(`Geospatial data unavailable for ${latitude}, ${longitude}`);
    }
  },
};

function calculateAverage(dataObj: Record<string, number>): number | string {
    if (!dataObj) return "N/A";
    const values = Object.values(dataObj).filter(v => v !== -999);
    if (values.length === 0) return "N/A";
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

function calculateSum(dataObj: Record<string, number>): number | string {
    if (!dataObj) return "N/A";
    const values = Object.values(dataObj).filter(v => v !== -999);
    if (values.length === 0) return "N/A";
    return Number(values.reduce((a, b) => a + b, 0).toFixed(2));
}

function calculateMax(dataObj: Record<string, number>): number | string {
    if (!dataObj) return "N/A";
    const values = Object.values(dataObj).filter(v => v !== -999);
    if (values.length === 0) return "N/A";
    return Number(Math.max(...values).toFixed(2));
}

function calculateMin(dataObj: Record<string, number>): number | string {
    if (!dataObj) return "N/A";
    const values = Object.values(dataObj).filter(v => v !== -999);
    if (values.length === 0) return "N/A";
    return Number(Math.min(...values).toFixed(2));
}
