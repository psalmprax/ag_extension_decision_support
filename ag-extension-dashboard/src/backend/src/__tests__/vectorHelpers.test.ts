import { query } from '../services/databaseService';
import {
    applyKeywordFilters,
    executeIlikeFallback,
    extractKeywordTerms,
    keywordSearch,
    mapKeywordRows,
    searchByTsQuery,
} from '../services/vector/keywordSearch';
import { fuseRankedLegs, retrievalSignals } from '../services/vector/rrfFusion';
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
            { id: 'a', content: 'c', title: 't', category: 'cat', crops: ['maize', 'rice'], source: 'FAOSTAT 2022 static fallback', source_url: 'u', content_type: null, score: '0.7' },
            { id: 'b', content: 'c', title: 't', category: 'cat', crops: null, source_url: 'u', content_type: 'text', score: null },
        ];
        const [first, second] = mapKeywordRows(rows);
        expect(first.metadata.crop).toBe('maize');
        expect(first.metadata.contentType).toBe('text');
        expect(first.metadata.source).toBe('FAOSTAT 2022 static fallback');
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
    const row = (id: string) => ({ id, content: 'c', title: 't', category: 'c', crops: [], source_url: 'u', content_type: 'text', score: 1 });

    it('returns AND results alone when they fill the limit', async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [row('a'), row('b')], rowCount: 2 });
        const res = await keywordSearch('maize fertilizer rate', 2, {});
        expect(res.map(r => r.id)).toEqual(['a', 'b']);
        expect(res.every(r => retrievalSignals(r).keywordMatch === 'all')).toBe(true);
        expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it('tops up full matches with partial matches, full matches first', async () => {
        mockedQuery
            .mockResolvedValueOnce({ rows: [row('a')], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [row('b'), row('a')], rowCount: 2 });
        const res = await keywordSearch('maize fertilizer rate', 5, {});
        expect(res.map(r => [r.id, retrievalSignals(r).keywordMatch])).toEqual([['a', 'all'], ['b', 'any']]);
        expect(String(mockedQuery.mock.calls[1][1]?.[0])).toBe('maize | fertilizer | rate');
    });

    it('keeps non-ASCII terms (an untranslated French question still matches)', () => {
        expect(extractKeywordTerms('maïs chenille légionnaire')).toEqual(['maïs', 'chenille', 'légionnaire']);
    });

    it('falls back to ILIKE for single-word misses', async () => {
        mockedQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({ rows: [{ id: 'b', content: 'c', title: 't', category: 'c', crops: [], source: 'FAOSTAT 2022 static fallback', source_url: 'u', content_type: 'text', score: 0.6 }], rowCount: 1 });
        const res = await keywordSearch('maize', 5, {});
        expect(res).toHaveLength(1);
        expect(res[0].score).toBe(0.6);
        expect(res[0].metadata.source).toBe('FAOSTAT 2022 static fallback');
        expect(String(mockedQuery.mock.calls[1][0])).toContain('source, source_url');
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
    it('ranks a document both legs found above documents found by one leg', () => {
        const ranked = fuseRankedLegs([
            { leg: 'vector', results: [doc('a'), doc('b')] },
            { leg: 'keyword', results: [doc('c'), doc('b')] },
        ], 3);
        expect(ranked[0].id).toBe('b');
        expect(ranked).toHaveLength(3);
    });

    it('does not let a keyword-only hit outrank an agreed hit (old +0.5 bias)', () => {
        const ranked = fuseRankedLegs([
            { leg: 'vector', results: [doc('agreed'), doc('vector-only')] },
            { leg: 'keyword', results: [doc('keyword-only'), doc('agreed')] },
        ], 3);
        expect(ranked.map(d => d.id)).toEqual(['agreed', 'keyword-only', 'vector-only']);
    });

    it('applies leg weights and keeps each leg\'s evidence', () => {
        const vectorHit = { ...doc('a'), metadata: { ...doc('a').metadata, retrieval: { vectorSimilarity: 0.71 } } };
        const keywordHit = { ...doc('a'), metadata: { ...doc('a').metadata, retrieval: { keywordMatch: 'any' as const } } };
        const [fused] = fuseRankedLegs([
            { leg: 'vector', results: [vectorHit] },
            { leg: 'keyword', results: [keywordHit] },
            { leg: 'chunk', results: [{ ...doc('a'), content: 'the matching passage' }], weight: 0.5 },
        ], 1, { preferContentFrom: 'chunk' });
        expect(fused.score).toBeCloseTo(2.5 / 61);
        expect(fused.content).toBe('the matching passage');
        expect(retrievalSignals(fused)).toMatchObject({
            vectorSimilarity: 0.71, keywordMatch: 'any', ranks: { vector: 1, keyword: 1, chunk: 1 },
        });
    });

    it('respects the limit and replaces scores with the fused score', () => {
        const ranked = fuseRankedLegs([{ leg: 'vector', results: [doc('a', 0.1), doc('b', 0.9)] }], 1);
        expect(ranked).toHaveLength(1);
        expect(ranked[0].score).toBeCloseTo(1 / 61);
    });
});
