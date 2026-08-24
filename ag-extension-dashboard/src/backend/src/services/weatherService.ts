import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';

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
        precipitationMm?: number;
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
     * Geocode a city name to coordinates, with rate-limits and caching.
     */
    private static async geocode(cityName: string, locationHint: string): Promise<{ latitude: number; longitude: number }> {
        const cacheKey = `geo:${cityName}`;
        const locationLower = locationHint;
        return rateLimitedFetch<{ latitude: number; longitude: number }>('openMeteo', cacheKey, async () => {
            const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
                params: { name: cityName, count: 5, language: 'en', format: 'json' },
            });
            if (!response.data?.results?.[0]) {
                throw new Error(`Location not found: ${locationHint}`);
            }
            let coords = response.data.results[0];
            const hints: Record<string, string> = {
                'kenya': 'KE', 'nigeria': 'NG', 'ghana': 'GH',
                'tanzania': 'TZ', 'uganda': 'UG', 'ethiopia': 'ET',
                'india': 'IN', 'brazil': 'BR', 'usa': 'US', 'united states': 'US',
            };
            for (const [hint, code] of Object.entries(hints)) {
                if (locationLower.includes(hint)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const match = response.data.results.find((r: any) => r.country_code === code);
                    if (match) { coords = match; break; }
                }
            }
            return { latitude: coords.latitude, longitude: coords.longitude };
        });
    }

    /**
     * Fetch forecast data from Open-Meteo, with rate-limits and caching.
     */
    private static async fetchForecast(lat: number, lng: number) {
        const cacheKey = `forecast:${lat.toFixed(2)}:${lng.toFixed(2)}`;
        return rateLimitedFetch<{
            current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
            daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum?: number[]; weather_code: number[] };
        }>('openMeteo', cacheKey, async () => {
            const resp = await axios.get('https://api.open-meteo.com/v1/forecast', {
                params: { latitude: lat, longitude: lng,
                    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
                    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
                    timezone: 'auto', forecast_days: 3 },
            });
            return resp.data;
        });
    }

    /**
     * Get current weather and forecast for a location using Open-Meteo (free, no API key)
     */
    static async getByLocation(location: string): Promise<WeatherData> {
        try {
            const cityName = location.split(',')[0].trim();
            const coords = await this.geocode(cityName, location.toLowerCase());
            const weatherResponse = await this.fetchForecast(coords.latitude, coords.longitude);
            const current = weatherResponse.current;
            const daily = weatherResponse.daily;

            return {
                temperature: Math.round(current.temperature_2m),
                temp: Math.round(current.temperature_2m),
                condition: getCondition(current.weather_code),
                humidity: Math.round(current.relative_humidity_2m),
                windSpeed: Math.round(current.wind_speed_10m),
                forecast: daily.time.map((date: string, i: number) => {
                    const precip = daily.precipitation_sum;
                    return {
                        date,
                        maxTemp: Math.round(daily.temperature_2m_max[i]),
                        minTemp: Math.round(daily.temperature_2m_min[i]),
                        precipitationMm: precip && Number.isFinite(precip[i]) ? Number(precip[i]) : undefined,
                        condition: getCondition(daily.weather_code[i])
                    };
                })
            };
        } catch (error) {
            logger.error(`Weather API request failed for ${location}:`, error);
            throw error;
        }
    }
}
