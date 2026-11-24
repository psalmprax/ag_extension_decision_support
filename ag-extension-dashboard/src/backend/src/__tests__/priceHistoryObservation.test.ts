const mockHashStore = new Map<string, Map<string, string>>();

jest.mock('../services/cacheService', () => ({
    cacheHSet: jest.fn(async (key: string, field: string, value: string) => {
        const hash = mockHashStore.get(key) ?? new Map<string, string>();
        hash.set(field, value);
        mockHashStore.set(key, hash);
        return true;
    }),
    cacheHGetAll: jest.fn(async (key: string) => {
        const hash = mockHashStore.get(key);
        return hash ? Object.fromEntries(hash) : null;
    }),
    cacheHDel: jest.fn(async (key: string, ...fields: string[]) => {
        const hash = mockHashStore.get(key);
        fields.forEach(field => hash?.delete(field));
        return true;
    }),
    cacheExpire: jest.fn(async () => true),
}));
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { getPriceHistory, recordPriceSnapshot } from '../services/priceHistoryService';
import type { MarketPrice } from '../services/marketPriceService';

const today = new Date().toISOString().split('T')[0];

const priceRow = (overrides: Partial<MarketPrice> = {}): MarketPrice => ({
    id: 'faostat-114-0112-0',
    crop: 'Maize (Corn)',
    price: 'KES 40',
    priceValue: 40,
    trend: 'New',
    updatedAt: new Date('2026-11-18T00:00:00Z'),
    source: 'faostat_producer_prices',
    dataStatus: 'live',
    fetchedAt: '2026-11-18T00:00:00Z',
    exchangeRateSource: 'live',
    currency: 'KES',
    period: '2025',
    priceType: 'producer',
    ...overrides,
});

describe('price history keeps observation time separate from record time', () => {
    beforeEach(() => {
        mockHashStore.clear();
    });

    it('stores the publication period, not just the day it was recorded', async () => {
        await recordPriceSnapshot('114', [priceRow()]);

        const [series] = await getPriceHistory('114', 30);

        expect(series.observedPeriod).toBe('2025');
        expect(series.priceType).toBe('producer');
        // The point of the exercise: the point on the chart is today's
        // valuation of a 2025 figure, and both facts survive.
        expect(series.series[0].date).toBe(today);
        expect(series.series[0].date).not.toBe('2025');
    });

    it('never records synthetic estimates as observations', async () => {
        await recordPriceSnapshot('114', [
            priceRow({ dataStatus: 'estimated', source: 'giews_fpma', priceType: null }),
        ]);

        expect(await getPriceHistory('114', 30)).toEqual([]);
    });

    it('keeps wholesale separate from producer', async () => {
        await recordPriceSnapshot('114', [
            priceRow({ crop: 'Maize', source: 'giews_fpma', priceType: 'wholesale', period: undefined }),
        ]);

        const [series] = await getPriceHistory('114', 30);

        expect(series.priceType).toBe('wholesale');
        expect(series.observedPeriod).toBeNull();
    });

    it('reads entries written before the period was recorded', async () => {
        mockHashStore.set(
            'ext:price_history:114',
            new Map([
                [
                    `${today}:Maize`,
                    JSON.stringify({
                        date: today,
                        crop: 'Maize',
                        price: 40,
                        currency: 'KES',
                        source: 'faostat_producer_prices',
                        dataStatus: 'live',
                    }),
                ],
            ])
        );

        const [series] = await getPriceHistory('114', 30);

        expect(series).toMatchObject({ observedPeriod: null, priceType: null });
        expect(series.series).toHaveLength(1);
    });
});
