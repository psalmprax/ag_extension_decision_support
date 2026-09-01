import axios from 'axios';
import { WeatherService } from '../services/weatherService';
import { weatherTool } from '../tools/weatherTool';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Weather Service & Tool Integration (WeatherAPI.com & Open-Meteo Fallback)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WEATHER_API_KEY;
  });

  it('fetches weather using WeatherAPI.com when WEATHER_API_KEY is configured', async () => {
    process.env.WEATHER_API_KEY = 'test-weather-key';

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        current: {
          temp_c: 24.5,
          condition: { text: 'Sunny' },
          humidity: 62,
          wind_kph: 12.0,
          precip_mm: 0.0,
          uv: 7.0,
        },
        forecast: {
          forecastday: [
            {
              date: '2026-09-01',
              day: {
                maxtemp_c: 26.0,
                mintemp_c: 15.0,
                totalprecip_mm: 2.5,
                avghumidity: 65,
                maxwind_kph: 14.0,
                condition: { text: 'Patchy rain possible' },
              },
            },
          ],
        },
        alerts: {
          alert: [
            {
              event: 'Flood Watch',
              headline: 'Heavy rainfall warning in low-lying zones',
              severity: 'Severe',
              urgency: 'Immediate',
              desc: 'Move livestock to higher ground.',
            },
          ],
        },
      },
    });

    const weather = await WeatherService.getByLocation('Nakuru, Kenya', 1);

    expect(weather.source).toContain('WeatherAPI.com');
    expect(weather.temperature).toBe(25);
    expect(weather.humidity).toBe(62);
    expect(weather.alerts).toHaveLength(1);
    expect(weather.alerts?.[0].event).toBe('Flood Watch');
    expect(weather.forecast[0].precipitationMm).toBe(2.5);
  });

  it('falls back to Open-Meteo when no WEATHER_API_KEY is present', async () => {
    // 1. Geocoding mock
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [{ latitude: -0.3031, longitude: 36.08, country_code: 'KE' }],
      },
    });

    // 2. Open-Meteo forecast mock
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        current: {
          temperature_2m: 21.4,
          relative_humidity_2m: 70,
          weather_code: 61, // Slight rain
          wind_speed_10m: 10,
        },
        daily: {
          time: ['2026-09-01'],
          temperature_2m_max: [24.0],
          temperature_2m_min: [14.0],
          precipitation_sum: [4.2],
          weather_code: [61],
        },
      },
    });

    const weather = await WeatherService.getByLocation('Eldoret, Kenya', 1);

    expect(weather.source).toContain('Open-Meteo');
    expect(weather.temperature).toBe(21);
    expect(weather.condition).toBe('Slight rain');
    expect(weather.forecast[0].precipitationMm).toBe(4.2);
  });

  it('executes weatherTool successfully and returns agricultural advice', async () => {
    process.env.WEATHER_API_KEY = 'test-key';

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        current: {
          temp_c: 22.0,
          condition: { text: 'Light rain' },
          humidity: 80,
          wind_kph: 8.0,
          precip_mm: 5.0,
          uv: 4.0,
        },
        forecast: {
          forecastday: [
            {
              date: '2026-09-01',
              day: {
                maxtemp_c: 23.0,
                mintemp_c: 16.0,
                totalprecip_mm: 5.0,
                condition: { text: 'Light rain' },
              },
            },
          ],
        },
      },
    });

    const toolResultJson = await weatherTool.execute({ location: 'Kitale', days: 1 });
    const parsed = JSON.parse(toolResultJson);

    expect(parsed.location).toBe('Kitale');
    expect(parsed.forecast[0].advice).toContain('top-dressing fertilizer');
  });
});
