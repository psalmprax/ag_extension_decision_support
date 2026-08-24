import axios from 'axios';
import { calculateWeatherScore } from '../tools/cropYieldForecastTool';
import { SatelliteService } from '../services/satelliteService';
import { SoilGridsService } from '../services/data/soilGridsService';
import { FaostatService } from '../services/data/faostatService';
import { marketPriceService } from '../services/marketPriceService';

jest.mock('axios');
jest.mock('../services/databaseService', () => ({
  query: jest.fn(),
}));
jest.mock('../services/prismaService', () => ({
  getPrisma: jest.fn(() => ({
    user: { findUnique: jest.fn() },
    farmer: { findFirst: jest.fn() },
  })),
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const weather = {
  temperature: 24,
  temp: 24,
  condition: 'Clear sky',
  humidity: 60,
  windSpeed: 8,
  forecast: [
    { date: '2026-08-24', maxTemp: 28, minTemp: 18, precipitationMm: 0, condition: 'Clear sky' },
    { date: '2026-08-25', maxTemp: 27, minTemp: 18, precipitationMm: 12, condition: 'Moderate rain' },
  ],
};

describe('production data truthfulness', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedAxios.get.mockReset();
    delete process.env.SENTINEL_HUB_CLIENT_ID;
    delete process.env.SENTINEL_HUB_CLIENT_SECRET;
    delete process.env.NASA_EARTHDATA_KEY;
  });

  it('uses actual precipitation in weather scoring', () => {
    const rainy = calculateWeatherScore(weather, 'maize');
    const dry = calculateWeatherScore({ ...weather, forecast: weather.forecast.map(day => ({ ...day, precipitationMm: 0 })) }, 'maize');

    expect(rainy.dataStatus).toBe('complete');
    expect(rainy.score).toBeGreaterThan(dry.score);
  });

  it('marks missing precipitation as partial instead of treating it as rain', () => {
    const result = calculateWeatherScore({ ...weather, forecast: weather.forecast.map(({ precipitationMm: _ignored, ...day }) => day) }, 'maize');

    expect(result.dataStatus).toBe('partial');
    expect(result.score).toBeLessThan(calculateWeatherScore(weather, 'maize').score);
  });

  it('does not generate historical NDVI values without a provider history query', async () => {
    const result = await SatelliteService.getNDVITimeSeries(-1.28, 36.82);

    expect(result.data).toEqual([]);
    expect(result.dataStatus).toBe('unavailable');
  });

  it('returns explicit unavailable soil data after provider failure', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('SoilGrids unavailable'));
    const result = await new SoilGridsService().fetchSoilProperties(-1.28, 36.82);

    expect(result.dataStatus).toBe('unavailable');
    expect(result.ph).toBe('N/A');
    fetchMock.mockRestore();
  });

  it('marks static FAOSTAT articles with fallback provenance', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('FAOSTAT unavailable'));
    const articles = await new FaostatService().generateCountryArticles();

    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].source).toBe('FAOSTAT 2022 static fallback');
    fetchMock.mockRestore();
  });

  it('returns labeled market estimates without mutating the database', async () => {
    mockedAxios.get.mockResolvedValue({ data: { rates: { KES: 130 } } });
    const prices = await marketPriceService.getLatestPrices();

    expect(prices).toHaveLength(4);
    expect(prices[0].source).toBe('baseline_estimate');
    expect(prices[0].dataStatus).toBe('estimated');
    expect(prices[0].price).toContain('KES');
  });
});
