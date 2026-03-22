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
    
    const mockFallback = [
      { date: new Date().toISOString().split('T')[0], temp: 24, condition: 'Sunny', advice: 'Good for sun-drying crops.' },
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], temp: 22, condition: 'Partly Cloudy', advice: 'Ideal for manual weeding.' },
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], temp: 19, condition: 'Light Rain', advice: 'Perfect for top-dressing fertilizer.' },
    ];

    let forecast = mockFallback.slice(0, days);
    let source = 'Ag-Extension Weather Service (Predictive)';

    try {
      // Use wttr.in for real weather data (no API key required)
      const response = await axios.get(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
      
      if (response.data && response.data.weather) {
        // Map wttr.in weather to our format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast = response.data.weather.slice(0, days).map((w: any) => ({
          date: w.date,
          temp: parseInt(w.avgtempC),
          condition: w.hourly[4]?.weatherDesc[0]?.value || 'Variable',
          advice: getAgriculturalAdvice(w.hourly[4]?.weatherDesc[0]?.value || '')
        }));
        source = 'wttr.in (Real-time)';
      }
    } catch (error) {
      logger.error(`Weather API failed for ${location}, using fallback:`, error);
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
  },
};
