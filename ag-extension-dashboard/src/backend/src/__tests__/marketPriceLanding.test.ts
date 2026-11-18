jest.mock('@/services/cacheService', () => ({
    cacheGet: jest.fn(async () => null),
    cacheSet: jest.fn(async () => true),
}));
jest.mock('@/services/externalApiGuard', () => ({ rateLimitedFetch: jest.fn() }));
jest.mock('@/services/prismaService', () => ({ getPrisma: jest.fn() }));
jest.mock('@/services/priceHistoryService', () => ({
    recordPriceSnapshot: jest.fn(async () => undefined),
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { cacheSet } from '@/services/cacheService';
import { rateLimitedFetch } from '@/services/externalApiGuard';
import { isPriceCountrySupported, marketPriceService } from '../services/marketPriceService';

const mockFetch = rateLimitedFetch as unknown as jest.Mock;
const mockCacheSet = cacheSet as unknown as jest.Mock;

const currentYear = String(new Date().getFullYear());
const lastYear = String(Number(currentYear) - 1);
const yearBefore = String(Number(currentYear) - 2);

const faoRow = (itemCode: string, value: number, year: string) => ({
    area: 'Kenya',
    item: itemCode,
    item_code: itemCode,
    element: '5532',
    year,
    unit: 'USD/tonne',
    value: String(value),
    flag: '',
});

/** The FAOSTAT cache key ends with the probed year, so the mock answers per year. */
function respondByYear(rowsByYear: Record<string, ReturnType<typeof faoRow>[]>): void {
    mockFetch.mockImplementation(async (_source: string, cacheKey: string) => {
        const year = String(cacheKey).split(':').pop() ?? '';
        return rowsByYear[year] ?? [];
    });
}

describe('landing producer prices', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('quotes the newest published year in native USD with a year-on-year change', async () => {
        respondByYear({
            [lastYear]: [
                faoRow('0112', 400, lastYear),
                faoRow('01591', 900, lastYear),
                faoRow('0115', 320, lastYear),
            ],
            [yearBefore]: [
                faoRow('0112', 380, yearBefore),
                faoRow('01591', 900, yearBefore),
                faoRow('0115', 320, yearBefore),
            ],
        });

        const snapshot = await marketPriceService.getLandingPrices('Kenya');

        expect(snapshot.dataStatus).toBe('live');
        // The current year is empty upstream; the card must show the real published year.
        expect(snapshot.period).toBe(lastYear);
        expect(snapshot.prices.map(price => price.cropCode)).toEqual(['0112', '01591', '0115']);

        const maize = snapshot.prices[0];
        expect(maize).toMatchObject({
            crop: 'Maize (Corn)',
            usdPerTonne: 400,
            usdPerKg: 0.4,
            usdPerBag90kg: 36,
            yoyPct: 5.3,
        });
        expect(snapshot.prices[1].yoyPct).toBe(0);
    });

    it('never converts currency: the figures stay in producer-price USD', async () => {
        respondByYear({ [lastYear]: [faoRow('0112', 400, lastYear)] });

        const snapshot = await marketPriceService.getLandingPrices('Kenya');

        // 400 USD/tonne, not 400 x KES rate.
        expect(snapshot.prices[0].usdPerTonne).toBe(400);
        expect(snapshot.prices[0].usdPerBag90kg).toBe(36);
    });

    it('reports unavailable instead of inventing prices when upstream has none', async () => {
        respondByYear({});

        const snapshot = await marketPriceService.getLandingPrices('Ghana');

        expect(snapshot).toMatchObject({ prices: [], period: null, dataStatus: 'unavailable' });
        // Short cache so a recovered upstream is picked up soon.
        expect(mockCacheSet).toHaveBeenCalledWith(
            'market-prices:landing:v1:Ghana',
            expect.any(String),
            30 * 60
        );
    });

    it('drops unusable values rather than quoting them', async () => {
        respondByYear({
            [lastYear]: [faoRow('0112', 0, lastYear), faoRow('01591', 900, lastYear)],
        });

        const snapshot = await marketPriceService.getLandingPrices('Kenya');

        expect(snapshot.prices.map(price => price.cropCode)).toEqual(['01591']);
    });

    it('caches a live snapshot for six hours', async () => {
        respondByYear({ [lastYear]: [faoRow('0112', 400, lastYear)] });

        await marketPriceService.getLandingPrices('Kenya');

        expect(mockCacheSet).toHaveBeenCalledWith(
            'market-prices:landing:v1:Kenya',
            expect.any(String),
            6 * 60 * 60
        );
    });

    it('knows which countries have a configured feed', () => {
        expect(isPriceCountrySupported('Malawi')).toBe(true);
        expect(isPriceCountrySupported('Kenya')).toBe(true);
        expect(isPriceCountrySupported('Atlantis')).toBe(false);
    });
});
