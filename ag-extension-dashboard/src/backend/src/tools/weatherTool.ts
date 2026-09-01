import { z } from 'zod';
import { Tool } from './types';
import { logger } from '@/utils/logger';
import { WeatherService } from '../services/weatherService';

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
  description:
    'Fetches the weather forecast for a specific agricultural region or city. Use this to provide advice on planting, harvesting, or pest control based on upcoming weather.',
  schema: WeatherSchema,
  execute: async ({ location, days }) => {
    logger.info(`Fetching weather for ${location} for ${days} days`);

    try {
      const weatherData = await WeatherService.getByLocation(location, days);

      const forecastWithAdvice = weatherData.forecast.map(day => ({
        date: day.date,
        temp: Math.round((day.maxTemp + day.minTemp) / 2),
        maxTemp: day.maxTemp,
        minTemp: day.minTemp,
        precipitationMm: day.precipitationMm,
        condition: day.condition,
        advice: getAgriculturalAdvice(day.condition),
      }));

      const result = {
        location,
        unit: 'Celsius',
        current: {
          temp: weatherData.temperature,
          condition: weatherData.condition,
          humidity: weatherData.humidity,
          windSpeedKmh: weatherData.windSpeed,
          precipitationMm: weatherData.precipitationMm,
          uvIndex: weatherData.uvIndex,
        },
        forecast: forecastWithAdvice,
        alerts: weatherData.alerts || [],
        source: weatherData.source,
      };

      return JSON.stringify(result);
    } catch (error) {
      logger.error(`Weather retrieval failed for ${location}:`, error);
      throw new Error(`Weather data unavailable for ${location}`);
    }
  },
};

/**
 * Helper to provide agricultural advice based on weather condition
 */
function getAgriculturalAdvice(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return 'Perfect for top-dressing fertilizer.';
  if (c.includes('sun') || c.includes('clear')) return 'Good for sun-drying crops.';
  if (c.includes('cloud') || c.includes('overcast')) return 'Ideal for manual weeding or soil preparation.';
  if (c.includes('wind') || c.includes('gale')) return 'Delay spraying pesticides to avoid drift.';
  return 'Monitor soil moisture and crop health.';
}
