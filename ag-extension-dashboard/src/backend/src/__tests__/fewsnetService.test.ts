import { getKenyaRetailSnapshot } from '../services/fewsnetService';

const realFetch = global.fetch;

function fewsRows(periodDate: string, entries: Array<{ market: string; value: number | null; delta?: number | null }>) {
    return entries.map(e => ({
        period_date: periodDate,
        market: e.market,
        value: e.value,
        unit: 'kg',
        currency: 'KES',
        pct_change_from_one_month_ago: e.delta ?? null,
        source_organization: 'KNBS, Kenya',
    }));
}

function mockFetchByDate(months: Record<string, unknown[]>) {
    (global.fetch as jest.Mock) = jest.fn(async (url: string) => {
        const m = String(url).match(/period_date=(\d{4}-\d{2}-\d{2})/);
        const rows = (m && months[m[1]]) || [];
        return { ok: true, json: async () => rows };
    });
}

afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = realFetch;
});

describe('fewsnetService.getKenyaRetailSnapshot', () => {
    it('takes the newest month with observations and medians across markets', async () => {
        const months: Record<string, unknown[]> = {};
        const monthEnds: string[] = [];
        const cursor = new Date();
        cursor.setDate(1);
        for (let i = 0; i < 4; i++) {
            monthEnds.push(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10));
            cursor.setMonth(cursor.getMonth() - 1);
        }
        // Newest month empty for maize; previous month has data.
        months[monthEnds[0]] = [];
        months[monthEnds[1]] = fewsRows(monthEnds[1], [
            { market: 'Ahero', value: 53.8, delta: -3.1 },
            { market: 'Wajir Town', value: 80.0, delta: null },
            { market: 'Wote', value: 55.0, delta: -9.1 },
        ]);
        mockFetchByDate(months);

        const result = await getKenyaRetailSnapshot();
        expect(result).not.toBeNull();
        expect(result?.periodDate).toBe(monthEnds[1]);
        const maize = result?.snapshots.find(s => s.crop === 'White Maize');
        expect(maize?.medianPrice).toBe(55);
        expect(maize?.marketCount).toBe(3);
        expect(maize?.currency).toBe('KES');
        // Median of [-3.1, -9.1] (nulls ignored)
        expect(maize?.trendPct).toBeCloseTo(-6.1, 1);
    });

    it('returns null when every probed month fails or is empty', async () => {
        (global.fetch as jest.Mock) = jest.fn(async () => ({ ok: true, json: async () => [] }));
        await expect(getKenyaRetailSnapshot()).resolves.toBeNull();
    });

    it('returns null when the provider is unreachable', async () => {
        (global.fetch as jest.Mock) = jest.fn(async () => { throw new Error('boom'); });
        await expect(getKenyaRetailSnapshot()).resolves.toBeNull();
    });

    it('drops non-numeric values and reports null trend without deltas', async () => {
        const months: Record<string, unknown[]> = {};
        const cursor = new Date();
        cursor.setDate(1);
        const newest = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10);
        months[newest] = fewsRows(newest, [
            { market: 'Ahero', value: null },
            { market: 'Kisumu', value: 60.0 },
            { market: 'Nakuru', value: 70.0 },
        ]);
        mockFetchByDate(months);

        const result = await getKenyaRetailSnapshot();
        const beans = result?.snapshots.find(s => s.crop === 'Dry Beans');
        expect(beans?.medianPrice).toBe(65);
        expect(beans?.trendPct).toBeNull();
    });
});
