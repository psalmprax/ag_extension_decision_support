import { clearWfpCaches, getWfpSnapshot, kgDivisor, parseCsv, resolveCsvUrl, WFP_COUNTRIES } from '../services/wfpService';

const realFetch = global.fetch;

const CSV = `date,admin1,admin2,market,market_id,latitude,longitude,category,commodity,commodity_id,unit,priceflag,pricetype,currency,price,usdprice
2026-08-15,Kampala,Kampala,Kalerwe,1,0.35,32.57,cereals and tubers,Beans,10,KG,actual,Retail,UGX,4375,1.18
2026-08-15,Kampala,Kampala,Nakasero,2,0.31,32.58,cereals and tubers,Beans,10,KG,actual,Retail,UGX,4200,1.13
2026-08-15,Kampala,Kampala,"Market, Central",3,0.30,32.57,cereals and tubers,Maize (white),11,2 KG,actual,Retail,UGX,8000,2.16
2026-07-15,Kampala,Kampala,Kalerwe,1,0.35,32.57,cereals and tubers,Beans,10,KG,actual,Retail,UGX,4000,1.08
2026-07-15,Kampala,Kampala,Nakasero,2,0.31,32.58,cereals and tubers,Beans,10,KG,actual,Retail,UGX,4100,1.10
2026-08-15,Kampala,Kampala,Kalerwe,1,0.35,32.57,cereals and tubers,Beans,10,KG,aggregate,Retail,UGX,9999,2.70
2026-08-15,Kampala,Kampala,Kalerwe,1,0.35,32.57,cereals and tubers,Beans,10,L,actual,Retail,UGX,5000,1.35
2026-08-15,Kampala,Kampala,Kalerwe,1,0.35,32.57,cereals and tubers,Beans,10,KG,actual,Wholesale,UGX,3000,0.81
`;

function mockHdx(csv: string) {
    (global.fetch as jest.Mock) = jest.fn(async (url: string) => {
        if (String(url).includes('package_show')) {
            return { ok: true, json: async () => ({ result: { resources: [{ format: 'CSV', url: 'https://example.test/wfp_uga.csv' }] } }) };
        }
        return { ok: true, text: async () => csv };
    });
}

afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = realFetch;
    clearWfpCaches();
});

describe('wfpService helpers', () => {
    it('parses quoted CSV fields without splitting', () => {
        const rows = parseCsv('a,b,c\n1,"x, y",3\n');
        expect(rows[1]).toEqual(['1', 'x, y', '3']);
    });

    it('converts KG-family units to per-kg divisors, rejects the rest', () => {
        expect(kgDivisor('KG')).toBe(1);
        expect(kgDivisor('90 KG')).toBe(90);
        expect(kgDivisor('2.5 KG')).toBe(2.5);
        expect(kgDivisor('400 G')).toBe(0.4);
        expect(kgDivisor('L')).toBeNull();
        expect(kgDivisor('Unit')).toBeNull();
        expect(kgDivisor('')).toBeNull();
    });

    it('exposes only verified-live countries', () => {
        expect(WFP_COUNTRIES).toEqual(expect.arrayContaining(['KE', 'NG', 'UG']));
        expect(WFP_COUNTRIES).not.toContain('GH');
    });
});

describe('wfpService.getWfpSnapshot', () => {
    it('medians per-kg retail actuals for the latest month only', async () => {
        mockHdx(CSV);
        const result = await getWfpSnapshot('UG');
        expect(result?.country).toBe('UG');
        expect(result?.periodDate).toBe('2026-08-15');
        const beans = result?.snapshots.find(s => s.crop === 'Beans');
        // Median of [4375, 4200]; aggregate/wholesale/L rows excluded
        expect(beans?.medianPrice).toBe(4287.5);
        expect(beans?.unit).toBe('kg');
        expect(beans?.currency).toBe('UGX');
        expect(beans?.marketCount).toBe(2);
        // Trend vs July median (4000+4100)/2 = 4050 → +5.86%
        expect(beans?.trendPct).toBeCloseTo(5.86, 1);
        const maize = result?.snapshots.find(s => s.crop === 'White Maize');
        // 8000 UGX per 2 KG → 4000/kg
        expect(maize?.medianPrice).toBe(4000);
        // No July maize rows → null trend, not zero
        expect(maize?.trendPct).toBeNull();
    });

    it('returns null for unsupported countries without fetching', async () => {
        const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
        (global.fetch as jest.Mock) = fetchMock;
        await expect(getWfpSnapshot('GH')).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null when HDX lookup or CSV fetch fails', async () => {
        (global.fetch as jest.Mock) = jest.fn(async () => { throw new Error('boom'); });
        await expect(getWfpSnapshot('UG')).resolves.toBeNull();
    });

    it('resolveCsvUrl picks the CSV resource', async () => {
        (global.fetch as jest.Mock) = jest.fn(async () => ({
            ok: true,
            json: async () => ({ result: { resources: [{ format: 'XLSX', url: 'x' }, { format: 'CSV', url: 'https://example.test/w.csv' }] } }),
        }));
        await expect(resolveCsvUrl('KE')).resolves.toBe('https://example.test/w.csv');
    });
});
