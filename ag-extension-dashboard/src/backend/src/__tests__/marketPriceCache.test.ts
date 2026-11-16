const store = new Map<string, { value: string; ttl?: number }>();
jest.mock('../services/cacheService', () => ({
    cacheGet: jest.fn(async (key: string) => store.get(key)?.value ?? null),
    cacheSet: jest.fn(async (key: string, value: string, ttl?: number) => { store.set(key, { value, ttl }); return true; }),
}));
jest.mock('../services/prismaService', () => ({ getPrisma: jest.fn() }));
jest.mock('../services/priceHistoryService', () => ({ recordPriceSnapshot: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { marketPriceService, type MarketPrice } from '../services/marketPriceService';

const row = (dataStatus: MarketPrice['dataStatus']): MarketPrice => ({
    id: 'r1', crop: 'Maize', price: 'KES 40', trend: 'New', updatedAt: new Date('2026-11-16T06:00:00Z'),
    source: 'faostat_producer_prices', dataStatus, fetchedAt: '2026-11-16T06:00:00Z', exchangeRateSource: 'live', currency: 'KES',
});

describe('market price cache', () => {
    let fetchSpy: jest.SpyInstance;
    beforeEach(() => {
        store.clear();
        fetchSpy = jest.spyOn(marketPriceService, 'fetchLatestPrices');
    });
    afterEach(() => fetchSpy.mockRestore());

    it('fetches upstream once, then serves the cached rows (dates intact)', async () => {
        fetchSpy.mockResolvedValue([row('live')]);
        await marketPriceService.getLatestPrices(undefined, 'KE');
        const second = await marketPriceService.getLatestPrices(undefined, 'KE');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(second[0].updatedAt).toBeInstanceOf(Date);
        expect(store.get('market-prices:v1:KE')?.ttl).toBe(6 * 60 * 60);
    });

    it('keeps estimates only briefly so a recovered upstream is used soon', async () => {
        fetchSpy.mockResolvedValue([row('estimated')]);
        await marketPriceService.getLatestPrices(undefined, 'NG');
        expect(store.get('market-prices:v1:NG')?.ttl).toBe(30 * 60);
    });

    it('lets concurrent cold requests share one upstream fetch', async () => {
        let release!: (rows: MarketPrice[]) => void;
        fetchSpy.mockReturnValue(new Promise<MarketPrice[]>(resolve => { release = resolve; }));
        const pending = [1, 2, 3].map(() => marketPriceService.getLatestPrices(undefined, 'UG'));
        release([row('live')]);
        const results = await Promise.all(pending);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(results.every(r => r[0].crop === 'Maize')).toBe(true);
    });

    it('does not cache a failed fetch', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('upstream down')).mockResolvedValueOnce([row('live')]);
        await expect(marketPriceService.getLatestPrices(undefined, 'TZ')).rejects.toThrow('upstream down');
        await expect(marketPriceService.getLatestPrices(undefined, 'TZ')).resolves.toHaveLength(1);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
