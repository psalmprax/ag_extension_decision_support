import axios from 'axios';
import { logger } from '@/utils/logger';

export interface WeatherData {
    temperature: number;
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    forecast: {
        date: string;
        maxTemp: number;
        minTemp: number;
        condition: string;
    }[];
}

// Map Open-Meteo weather codes to conditions
const getCondition = (code: number): string => {
    const conditions: { [key: number]: string } = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
    };
    return conditions[code] || 'Unknown';
};

export class WeatherService {
    /**
     * Get current weather and forecast for a location using Open-Meteo (free, no API key)
     */
    static async getByLocation(location: string): Promise<WeatherData> {
        try {
            // Extract just the city name (before any comma or country part)
            // The frontend passes "City, Country" but we only need "City" for geocoding
            const cityName = location.split(',')[0].trim();

            // First, geocode the location name to coordinates
            const geocodeResponse = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search`,
                { params: { name: cityName, count: 5, language: 'en', format: 'json' } }
            );

            if (!geocodeResponse.data?.results?.[0]) {
                logger.warn(`Location not found: ${location}`);
                throw new Error(`Location not found: ${location}`);
            }

            // Try to find a result matching the country if mentioned in the location string
            let coords = geocodeResponse.data.results[0];
            const locationLower = location.toLowerCase();
            const countryHints: Record<string, string> = {
                'germany': 'DE', 'deutschland': 'DE',
                'kenya': 'KE', 'nigeria': 'NG', 'ghana': 'GH',
                'tanzania': 'TZ', 'uganda': 'UG', 'ethiopia': 'ET',
                'india': 'IN', 'brazil': 'BR', 'usa': 'US', 'united states': 'US',
            };
            for (const [hint, code] of Object.entries(countryHints)) {
                if (locationLower.includes(hint)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const match = geocodeResponse.data.results.find((r: any) => r.country_code === code);
                    if (match) { coords = match; break; }
                }
            }

            const { latitude, longitude } = coords;

            // Get weather data from Open-Meteo
            const weatherResponse = await axios.get(
                `https://api.open-meteo.com/v1/forecast`,
                {
                    params: {
                        latitude,
                        longitude,
                        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
                        daily: 'temperature_2m_max,temperature_2m_min,weather_code',
                        timezone: 'auto',
                        forecast_days: 3
                    }
                }
            );

            const current = weatherResponse.data.current;
            const daily = weatherResponse.data.daily;

            return {
                temperature: Math.round(current.temperature_2m),
                temp: Math.round(current.temperature_2m),
                condition: getCondition(current.weather_code),
                humidity: Math.round(current.relative_humidity_2m),
                windSpeed: Math.round(current.wind_speed_10m),
                forecast: daily.time.map((date: string, i: number) => ({
                    date,
                    maxTemp: Math.round(daily.temperature_2m_max[i]),
                    minTemp: Math.round(daily.temperature_2m_min[i]),
                    condition: getCondition(daily.weather_code[i])
                }))
            };
        } catch (error) {
            logger.error(`Weather API request failed for ${location}:`, error);
            throw error;
        }
    }
}
