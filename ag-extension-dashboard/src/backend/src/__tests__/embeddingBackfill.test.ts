const mockQuery = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { backfillAllMissingEmbeddings } from '@/services/vector/embeddingBackfill';
import { AIUnavailableError } from '@/services/aiProvider/aiProvider';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `a-${i}`, content: `article ${i}` }));

describe('embedding backfill', () => {
    beforeEach(() => mockQuery.mockReset());

    it('stops after the first failure when no embedding provider is available', async () => {
        mockQuery.mockImplementation((sql: string) =>
            Promise.resolve(sql.includes('COUNT') ? { rows: [{ n: 3 }] } : { rows: rows(3) }));
        const upsert = jest.fn().mockRejectedValue(new AIUnavailableError('no provider is configured or healthy'));
        const result = await backfillAllMissingEmbeddings(100, 10_000, upsert);
        expect(upsert).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ processed: 0, failed: 1, remaining: 3, aborted: 'no embedding provider is available' });
    });

    it('does not count a failed row as embedded, and stops when a batch embeds nothing', async () => {
        mockQuery.mockImplementation((sql: string) =>
            Promise.resolve(sql.includes('COUNT') ? { rows: [{ n: 2 }] } : { rows: rows(2) }));
        const upsert = jest.fn().mockRejectedValue(new Error('timeout'));
        const result = await backfillAllMissingEmbeddings(100, 10_000, upsert);
        expect(upsert).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({ processed: 0, failed: 2, remaining: 2 });
    });

    it('drains batch after batch while rows keep embedding', async () => {
        let left = 5;
        mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
            if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ n: left }] });
            return Promise.resolve({ rows: rows(Math.min(left, Number(params?.[0]))) });
        });
        const upsert = jest.fn().mockImplementation(() => { left--; return Promise.resolve(); });
        const result = await backfillAllMissingEmbeddings(2, 10_000, upsert);
        expect(result).toMatchObject({ processed: 5, failed: 0, remaining: 0 });
    });
});
