import { z } from 'zod';
import { Tool } from './types';

import axios from 'axios';
import { logger } from '@/utils/logger';

// Define the schema for weather tool arguments
const WeatherSchema = z.object({
  location: z.string().describe('The city or region to get weather for'),
  days: z.number().optional().default(3).describe('Number of days for forecast (1-7)'),
});

/**
 * A tool that fetches weather forecast for a given location.
 */
export const weatherTool: Tool<typeof WeatherSchema> = {
  name: 'get_weather_forecast',
  description: 'Fetches the weather forecast for a specific agricultural region or city. Use this to provide advice on planting, harvesting, or pest control based on upcoming weather.',
  schema: WeatherSchema,
  execute: async ({ location, days }) => {
    logger.info(`Fetching weather for ${location} for ${days} days`);

    let forecast: { date: string; temp: number; condition: string; advice: string }[] = [];
    const source = 'wttr.in (Real-time)';

    try {
      const response = await axios.get(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
      
      if (response.data && response.data.weather) {
        forecast = response.data.weather.slice(0, days).map((w: any) => ({
          date: w.date,
          temp: parseInt(w.avgtempC),
          condition: w.hourly[4]?.weatherDesc[0]?.value || 'Variable',
          advice: getAgriculturalAdvice(w.hourly[4]?.weatherDesc[0]?.value || '')
        }));
      }
    } catch (error) {
      logger.error(`Weather API failed for ${location}:`, error);
      throw new Error(`Weather data unavailable for ${location}`);
    }

    const result = {
      location,
      unit: 'Celsius',
      forecast,
      source,
    };

    return JSON.stringify(result);
  },
};

/**
 * Helper to provide agricultural advice based on weather condition
 */
function getAgriculturalAdvice(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('shower')) return 'Perfect for top-dressing fertilizer.';
  if (c.includes('sunny') || c.includes('clear')) return 'Good for sun-drying crops.';
  if (c.includes('cloud')) return 'Ideal for manual weeding or soil preparation.';
  if (c.includes('wind')) return 'Delay spraying pesticides to avoid drift.';
  return 'Monitor soil moisture and crop health.';
}
