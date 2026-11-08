import { query } from '@/services/databaseService';
import { TropicalKnowledgeSourceService } from '@/services/data/tropicalKnowledgeSources';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: jest.fn() } }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('tropical source seeding', () => {
    beforeEach(() => jest.mocked(query).mockReset());

    it('counts only newly inserted sources', async () => {
        jest.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
        jest.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
        await expect(TropicalKnowledgeSourceService.seedSourcesFromStatic()).resolves.toBe(1);
        expect(jest.mocked(query).mock.calls.length).toBeGreaterThan(1);
    });

    it('propagates database failures', async () => {
        jest.mocked(query).mockRejectedValueOnce(new Error('database unavailable'));
        await expect(TropicalKnowledgeSourceService.seedSourcesFromStatic()).rejects.toThrow('database unavailable');
    });
});
