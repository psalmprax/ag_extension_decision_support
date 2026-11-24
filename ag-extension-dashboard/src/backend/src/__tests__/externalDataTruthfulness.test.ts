import axios from 'axios';
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

describe('production data truthfulness', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedAxios.get.mockReset();
    delete process.env.SENTINEL_HUB_CLIENT_ID;
    delete process.env.SENTINEL_HUB_CLIENT_SECRET;
    delete process.env.NASA_EARTHDATA_KEY;
    delete process.env.FAOSTAT_ALLOW_UNVERIFIED_FALLBACK;
  });

  it('gives no weather rather than made-up values when NASA POWER does not answer', async () => {
    const result = await SatelliteService.getDailyWeather(-1.28, 36.82);

    expect(result.data).toEqual([]);
    expect(result.dataStatus).toBe('unavailable');
  });

  it('reports NASA POWER rain and temperature as measured, leaving out its missing-value marks', async () => {
    const { NasaPowerService } = await import('@/services/nasaPowerService');
    const spy = jest.spyOn(NasaPowerService, 'getDaily').mockResolvedValue([
      { date: '2026-11-20', T2M: 21.44, PRECTOTCORR: 3.27 },
      { date: '2026-11-21', T2M: -999, PRECTOTCORR: 1 },
    ] as never);
    const result = await SatelliteService.getDailyWeather(-1.28, 36.82, 14);
    expect(result).toMatchObject({ source: 'nasa-power', dataStatus: 'live', data: [{ date: '2026-11-20', rainMm: 3.3, tempC: 21.4 }] });
    spy.mockRestore();
  });

  it('returns explicit unavailable soil data after provider failure', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('SoilGrids unavailable'));
    const result = await new SoilGridsService().fetchSoilProperties(-1.28, 36.82);

    expect(result.dataStatus).toBe('unavailable');
    expect(result.ph).toBe('N/A');
    fetchMock.mockRestore();
  });

  it('does not ingest unverified static FAOSTAT figures by default', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('FAOSTAT unavailable'));
    expect(await new FaostatService().generateCountryArticles()).toEqual([]);
  });

  it('marks explicitly enabled sandbox fallback articles with provenance', async () => {
    process.env.FAOSTAT_ALLOW_UNVERIFIED_FALLBACK = 'true';
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('FAOSTAT unavailable'));
    const articles = await new FaostatService().generateCountryArticles();

    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].source).toBe('FAOSTAT 2022 static fallback');
    expect(articles.find(article => article.title.endsWith('Malawi'))?.regions).toEqual(['Malawi']);
    expect(articles.find(article => article.title.endsWith('India'))?.regions).toEqual(['India']);
    expect(articles.find(article => article.title.endsWith('Malawi'))?.crops).toContain('tobacco');
    expect(articles.find(article => article.title.endsWith('Malawi'))?.crops).not.toContain('coffee, green');
    fetchMock.mockRestore();
  });

  it('never enables the unverified fallback in production', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.FAOSTAT_ALLOW_UNVERIFIED_FALLBACK = 'true';
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('FAOSTAT unavailable'));
    try {
      expect(await new FaostatService().generateCountryArticles()).toEqual([]);
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });

  it('gives no prices when it does not know the country, rather than another country’s', async () => {
    expect(await marketPriceService.getLatestPrices()).toEqual([]);
  });

  it('gives no prices when no source answers, rather than made-up ones', async () => {
    mockedAxios.get.mockResolvedValue({ data: { rates: { KES: 130 } } });
    expect(await marketPriceService.getLatestPrices(undefined, 'Kenya')).toEqual([]);
  });
});
