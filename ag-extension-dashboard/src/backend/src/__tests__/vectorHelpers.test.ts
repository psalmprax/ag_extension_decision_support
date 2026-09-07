import { query } from '../services/databaseService';
import {
    applyKeywordFilters,
    executeIlikeFallback,
    extractKeywordTerms,
    keywordSearch,
    mapKeywordRows,
    searchByTsQuery,
} from '../services/vector/keywordSearch';
import { addToRrfMap, mergeAndSortRrfResults } from '../services/vector/rrfFusion';
import type { SearchResult } from '../services/vectorService';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/databaseService', () => ({
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockedQuery = query as jest.Mock;

function doc(id: string, score = 0.5): SearchResult {
    return {
        id,
        content: `content-${id}`,
        metadata: { title: `title-${id}`, category: 'c', crop: 'maize', sourceUrl: `https://${id}`, contentType: 'text' },
        score,
    };
}

beforeEach(() => {
    mockedQuery.mockReset();
});

// ─── extractKeywordTerms ─────────────────────────────────────────────────────

describe('extractKeywordTerms', () => {
    it('drops stop words, punctuation, and short tokens', () => {
        expect(extractKeywordTerms('What are the signs of fall-armyworm in maize?')).toEqual(
            expect.arrayContaining(['signs', 'fall', 'armyworm', 'maize'])
        );
        expect(extractKeywordTerms('What are the signs of fall-armyworm in maize?')).not.toContain('what');
    });

    it('returns no terms for stop-word-only input', () => {
        expect(extractKeywordTerms('what is the and for')).toEqual([]);
    });
});

// ─── applyKeywordFilters ─────────────────────────────────────────────────────

describe('applyKeywordFilters', () => {
    it('adds no clauses without filters', () => {
        const params: Array<string | number> = ['q'];
        const where = ['base'];
        applyKeywordFilters(params, where, {});
        expect(params).toEqual(['q']);
        expect(where).toEqual(['base']);
    });

    it('appends category and crop clauses with correct placeholders', () => {
        const params: Array<string | number> = ['q'];
        const where = ['base'];
        applyKeywordFilters(params, where, { category: 'pest', crop: 'maize' });
        expect(params).toEqual(['q', 'pest', 'maize']);
        expect(where).toEqual(['base', 'category = $2', '$3 = ANY(crops)']);
    });
});

// ─── mapKeywordRows ──────────────────────────────────────────────────────────

describe('mapKeywordRows', () => {
    it('maps rows to SearchResults with crop head and text fallback', () => {
        const rows = [
            { id: 'a', content: 'c', title: 't', category: 'cat', crops: ['maize', 'rice'], source_url: 'u', content_type: null, score: '0.7' },
            { id: 'b', content: 'c', title: 't', category: 'cat', crops: null, source_url: 'u', content_type: 'text', score: null },
        ];
        const [first, second] = mapKeywordRows(rows);
        expect(first.metadata.crop).toBe('maize');
        expect(first.metadata.contentType).toBe('text');
        expect(first.score).toBeCloseTo(0.7);
        expect(second.metadata.crop).toBeUndefined();
        expect(second.score).toBe(0);
    });
});

// ─── searchByTsQuery / keywordSearch ─────────────────────────────────────────

describe('searchByTsQuery', () => {
    it('queries with the tsquery and maps ranked rows', async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'a', content: 'c', title: 't', category: 'c', crops: [], source_url: 'u', content_type: 'text', score: 1.2 }], rowCount: 1 });
        const res = await searchByTsQuery('maize & rice', 5, {});
        expect(mockedQuery).toHaveBeenCalledTimes(1);
        expect(String(mockedQuery.mock.calls[0][0])).toContain('to_tsquery');
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('a');
    });
});

describe('keywordSearch', () => {
    it('returns AND results on precision hit', async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'a', content: 'c', title: 't', category: 'c', crops: [], source_url: 'u', content_type: 'text', score: 1 }], rowCount: 1 });
        const res = await keywordSearch('maize fertilizer rate', 5, {});
        expect(res).toHaveLength(1);
        expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it('falls back to ILIKE for single-word misses', async () => {
        mockedQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({ rows: [{ id: 'b', content: 'c', title: 't', category: 'c', crops: [], source_url: 'u', content_type: 'text', score: 0.6 }], rowCount: 1 });
        const res = await keywordSearch('maize', 5, {});
        expect(res).toHaveLength(1);
        expect(res[0].score).toBe(0.6);
        expect(String(mockedQuery.mock.calls[1][0])).toContain('ILIKE');
    });

    it('tries OR recall for multi-word misses before ILIKE', async () => {
        mockedQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({ rows: [{ id: 'c', content: 'c', title: 't', category: 'c', crops: [], source_url: 'u', content_type: 'text', score: 0.4 }], rowCount: 1 });
        const res = await keywordSearch('maize fertilizer rate', 5, {});
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('c');
    });

    it('returns [] on total failure', async () => {
        mockedQuery.mockRejectedValueOnce(new Error('db down'));
        await expect(keywordSearch('maize', 5, {})).resolves.toEqual([]);
    });
});

describe('executeIlikeFallback', () => {
    it('returns [] for blank input without querying', async () => {
        await expect(executeIlikeFallback('   ', 5, {})).resolves.toEqual([]);
        expect(mockedQuery).not.toHaveBeenCalled();
    });
});

// ─── RRF fusion ──────────────────────────────────────────────────────────────

describe('rrfFusion', () => {
    it('ranks shared documents above single-source ones', () => {
        const rrf = new Map<string, { doc: SearchResult; score: number }>();
        addToRrfMap(rrf, [doc('a'), doc('b')], 60);
        addToRrfMap(rrf, [doc('b'), doc('c')], 60);
        const ranked = mergeAndSortRrfResults(rrf, 3);
        expect(ranked.map(d => d.id)[0]).toBe('b');
        expect(ranked).toHaveLength(3);
    });

    it('applies the keyword recall bias over vector-only hits', () => {
        const rrf = new Map<string, { doc: SearchResult; score: number }>();
        addToRrfMap(rrf, [doc('a')], 60);
        addToRrfMap(rrf, [doc('b')], 60, 0.5);
        const ranked = mergeAndSortRrfResults(rrf, 2);
        expect(ranked.map(d => d.id)[0]).toBe('b');
    });

    it('respects the limit and rewrites doc scores', () => {
        const rrf = new Map<string, { doc: SearchResult; score: number }>();
        addToRrfMap(rrf, [doc('a', 0.1), doc('b', 0.9)], 60);
        const ranked = mergeAndSortRrfResults(rrf, 1);
        expect(ranked).toHaveLength(1);
        expect(ranked[0].score).not.toBe(0.9);
    });
});
