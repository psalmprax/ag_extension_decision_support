import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { VectorService } from '@/services/vectorService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/embeddingCache', () => ({ getEmbedding: jest.fn() }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

it('preserves the source of a vector search result', async () => {
    jest.mocked(getEmbedding).mockResolvedValueOnce([0.1, 0.2]);
    jest.mocked(query).mockResolvedValueOnce({
        rows: [{
            id: 'one', title: 'Malawi', content: 'Historical data', crops: ['maize'],
            source: 'FAOSTAT 2022 static fallback', source_url: 'https://example.test', score: 0.9,
        }],
        rowCount: 1,
    });
    const results = await VectorService.search('maize');
    expect(results[0].metadata.source).toBe('FAOSTAT 2022 static fallback');
    expect(jest.mocked(query).mock.calls[0][0]).toContain('source, source_url');
});
