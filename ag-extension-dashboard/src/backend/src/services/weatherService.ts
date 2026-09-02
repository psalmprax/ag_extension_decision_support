import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';
import { config } from '../config';

export interface WeatherData {
  temperature: number;
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitationMm?: number;
  uvIndex?: number;
  alerts?: Array<{
    event: string;
    headline: string;
    severity: string;
    urgency: string;
    desc: string;
  }>;
  forecast: {
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitationMm?: number;
    relativeHumidityPct?: number;
    windSpeedKmh?: number;
    condition: string;
  }[];
  source?: string;
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
  private static getWeatherApiKey(): string {
    return process.env.WEATHER_API_KEY || config.externalApis.weather.apiKey || '';
  }

  private static getWeatherApiUrl(): string {
    return process.env.WEATHER_API_URL || config.externalApis.weather.url || 'https://api.weatherapi.com/v1';
  }

  /**
   * Fetch current and forecast weather using WeatherAPI.com (when API key is available)
   */
  private static async fetchWeatherApiForecast(location: string, days: number = 3): Promise<WeatherData> {
    const apiKey = this.getWeatherApiKey();
    const baseUrl = this.getWeatherApiUrl();
    const cacheKey = `weatherapi:${location}:${days}`;

    return rateLimitedFetch<WeatherData>('weatherApi', cacheKey, async () => {
      logger.info(`Fetching weather from WeatherAPI.com for ${location} (${days} days)`);

      const resp = await axios.get(`${baseUrl}/forecast.json`, {
        params: {
          key: apiKey,
          q: location,
          days: Math.min(14, Math.max(1, days)),
          aqi: 'no',
          alerts: 'yes',
        },
        timeout: 10000,
      });

      const data = resp.data;
      const current = data.current;
      const forecastDays = data.forecast?.forecastday || [];
      const alerts = (data.alerts?.alert || []).map((a: { event?: string; headline?: string; severity?: string; urgency?: string; desc?: string }) => ({
        event: a.event || 'Weather Warning',
        headline: a.headline || '',
        severity: a.severity || 'Moderate',
        urgency: a.urgency || 'Future',
        desc: a.desc || '',
      }));

      return {
        temperature: Math.round(current.temp_c),
        temp: Math.round(current.temp_c),
        condition: current.condition?.text || 'Clear',
        humidity: Math.round(current.humidity),
        windSpeed: Math.round(current.wind_kph),
        precipitationMm: Number(current.precip_mm || 0),
        uvIndex: Number(current.uv || 0),
        alerts,
        forecast: forecastDays.map((day: { date: string; day: { maxtemp_c: number; mintemp_c: number; totalprecip_mm?: number; avghumidity?: number; maxwind_kph?: number; condition?: { text?: string } } }) => ({
          date: day.date,
          maxTemp: Math.round(day.day.maxtemp_c),
          minTemp: Math.round(day.day.mintemp_c),
          precipitationMm: Number(day.day.totalprecip_mm || 0),
          relativeHumidityPct: Number(day.day.avghumidity || current.humidity),
          windSpeedKmh: Number(day.day.maxwind_kph || current.wind_kph),
          condition: day.day.condition?.text || 'Variable',
        })),
        source: 'WeatherAPI.com (Real-time & Forecast)',
      };
    });
  }

  /**
   * Geocode a city name to coordinates for Open-Meteo fallback
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
        kenya: 'KE',
        nigeria: 'NG',
        ghana: 'GH',
        tanzania: 'TZ',
        uganda: 'UG',
        ethiopia: 'ET',
        india: 'IN',
        brazil: 'BR',
        usa: 'US',
        'united states': 'US',
      };
      for (const [hint, code] of Object.entries(hints)) {
        if (locationLower.includes(hint)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const match = response.data.results.find((r: any) => r.country_code === code);
          if (match) {
            coords = match;
            break;
          }
        }
      }
      return { latitude: coords.latitude, longitude: coords.longitude };
    });
  }

  /**
   * Fetch forecast data from Open-Meteo fallback
   */
  private static async fetchOpenMeteoForecast(lat: number, lng: number, days: number = 3) {
    const cacheKey = `forecast:${lat.toFixed(2)}:${lng.toFixed(2)}:${days}`;
    return rateLimitedFetch<{
      current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum?: number[];
        weather_code: number[];
      };
    }>('openMeteo', cacheKey, async () => {
      const resp = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lng,
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
          timezone: 'auto',
          forecast_days: days,
        },
      });
      return resp.data;
    });
  }

  /**
   * Unified weather retrieval: Uses WeatherAPI.com when configured, with automatic fallback to Open-Meteo
   */
  static async getByLocation(location: string, days: number = 3): Promise<WeatherData> {
    const apiKey = this.getWeatherApiKey();

    if (apiKey) {
      try {
        return await this.fetchWeatherApiForecast(location, days);
      } catch (err) {
        logger.warn(`WeatherAPI.com request failed for ${location}. Falling back to Open-Meteo.`, err);
      }
    }

    try {
      const cityName = location.split(',')[0].trim();
      const coords = await this.geocode(cityName, location.toLowerCase());
      const weatherResponse = await this.fetchOpenMeteoForecast(coords.latitude, coords.longitude, days);
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
            precipitationMm: precip && Number.isFinite(precip[i]) ? Number(precip[i]) : 0,
            relativeHumidityPct: Math.round(current.relative_humidity_2m),
            windSpeedKmh: Math.round(current.wind_speed_10m),
            condition: getCondition(daily.weather_code[i]),
          };
        }),
        source: 'Open-Meteo (Free Fallback)',
      };
    } catch (error) {
      logger.error(`All weather services failed for ${location}:`, error);
      throw error;
    }
  }

  /**
   * Fetch historical weather for parametric insurance claim auditing (WeatherAPI.com /history.json)
   * `dataStatus` lets callers distinguish measured observations from the offline no-key mock.
   */
  // fallow-ignore-next-line unused-class-member
  static async getHistoricalWeather(location: string, date: string): Promise<{ date: string; avgTempC: number; maxTempC: number; minTempC: number; totalPrecipMm: number; dataStatus: 'live' | 'mock_estimate'; source: string }> {
    const apiKey = this.getWeatherApiKey();
    const baseUrl = this.getWeatherApiUrl();

    if (!apiKey) {
      // Offline / no-key mock estimate for test and offline environments.
      // Explicitly marked so claim-audit callers never mistake it for real data.
      logger.warn(`Historical weather mock returned for ${location} ${date}: WEATHER_API_KEY not configured`);
      return {
        date,
        avgTempC: 22.0,
        maxTempC: 27.0,
        minTempC: 15.0,
        totalPrecipMm: 0,
        dataStatus: 'mock_estimate',
        source: 'offline_mock (no WEATHER_API_KEY)',
      };
    }

    const resp = await axios.get(`${baseUrl}/history.json`, {
      params: { key: apiKey, q: location, dt: date },
      timeout: 10000,
    });

    const dayData = resp.data?.forecast?.forecastday?.[0]?.day;
    return {
      date,
      avgTempC: dayData?.avgtemp_c ?? 20.0,
      maxTempC: dayData?.maxtemp_c ?? 25.0,
      minTempC: dayData?.mintemp_c ?? 14.0,
      totalPrecipMm: dayData?.totalprecip_mm ?? 0,
      dataStatus: 'live' as const,
      source: 'WeatherAPI.com /history.json',
    };
  }
}
