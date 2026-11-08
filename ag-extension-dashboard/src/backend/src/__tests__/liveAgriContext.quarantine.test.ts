import { fetchLiveAgriContext } from '@/services/knowledge/liveAgriContext';
import { splitQuarantined, isQuarantined } from '@/services/knowledge/groundingPolicy';
import { buildAdvisoryEvidence } from '@/services/knowledge/advisoryPolicy';
import { FAOService } from '@/services/faoService';
import { marketPriceService } from '@/services/marketPriceService';

jest.mock('@/services/faoService', () => ({
    FAOService: { getDiseaseAlerts: jest.fn() },
}));
jest.mock('@/services/marketPriceService', () => ({
    marketPriceService: { getLatestPrices: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Live advisory source quarantine', () => {
    beforeEach(() => jest.clearAllMocks());

    it('withholds actual FAOSTAT anomaly adapter results from grounding', async () => {
        jest.mocked(FAOService.getDiseaseAlerts).mockResolvedValue([{
            id: 'alert', title: 'Production decline', description: 'Unverified anomaly',
            severity: 'medium', crop: 'maize', region: 'Kenya', publishedDate: '2025-01-01',
        }]);
        const results = await fetchLiveAgriContext(['pest_and_disease'], { region: 'Kenya', crop: 'maize' });
        const { groundable, withheld } = splitQuarantined(results);
        expect(withheld).toHaveLength(1);
        expect(withheld[0]?.content).toContain('Unverified anomaly');
        expect(groundable).toHaveLength(0);
        expect(buildAdvisoryEvidence(results).context).not.toContain('Unverified anomaly');
    });

    it('separates FAOSTAT-derived prices from other live providers', async () => {
        const price = (source: 'faostat_producer_prices' | 'giews_fpma' | 'wfp', value: string) => ({
            id: source, crop: 'Maize', price: value, trend: 'stable', updatedAt: new Date(),
            source, dataStatus: 'live' as const, fetchedAt: '2025-01-01',
            exchangeRateSource: 'native' as const, currency: 'USD',
        });
        jest.mocked(marketPriceService.getLatestPrices).mockResolvedValue([
            price('faostat_producer_prices', 'FAOSTAT_VALUE'),
            price('giews_fpma', 'GIEWS_FAOSTAT_VALUE'),
            price('wfp', 'WFP_VALUE'),
        ]);
        const results = await fetchLiveAgriContext(['market_prices'], { country: 'Kenya', crop: 'maize' });
        const { groundable, withheld } = splitQuarantined(results);
        const evidence = buildAdvisoryEvidence(results, { country: 'Kenya' });
        expect(groundable).toHaveLength(1);
        expect(withheld).toHaveLength(1);
        expect(withheld[0]?.content).toContain('FAOSTAT_VALUE');
        expect(withheld[0]?.content).toContain('GIEWS_FAOSTAT_VALUE');
        expect(evidence.context).toContain('WFP_VALUE');
        expect(evidence.context).not.toContain('FAOSTAT_VALUE');
    });

    it('recognizes FAOSTAT provenance from legacy URLs and machine-readable source names', () => {
        const result = (metadata: Record<string, unknown>) => ({ id: 'x', content: 'x', score: 1, metadata });
        expect(isQuarantined(result({ source: 'faostat_producer_prices' }))).toBe(true);
        expect(isQuarantined(result({ sourceUrl: 'https://www.fao.org/faostat/en/' }))).toBe(true);
        expect(isQuarantined(result({ sourceUrl: 'https://fenixservices.fao.org/faostat/api/v1/en/data/QCL' }))).toBe(true);
        expect(isQuarantined(result({ sourceUrl: 'https://example.com/faostat' }))).toBe(false);
    });
});
