import { z } from 'zod';
import { Tool } from './types';

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
    
    // In a real implementation, we would call an external API
    // Using mock data for now based on the provided location
    
    const mockForecast = [
      { date: '2024-03-20', temp: 24, condition: 'Sunny', advice: 'Good for sun-drying crops.' },
      { date: '2024-03-21', temp: 22, condition: 'Partly Cloudy', advice: 'Ideal for manual weeding.' },
      { date: '2024-03-22', temp: 19, condition: 'Light Rain', advice: 'Perfect for top-dressing fertilizer.' },
    ];

    const result = {
      location,
      unit: 'Celsius',
      forecast: mockForecast.slice(0, days),
      source: 'Ag-Extension Weather Service (Predictive)',
    };

    return JSON.stringify(result);
  },
};
