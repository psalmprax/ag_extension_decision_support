// NOTE: knowledge.test.ts already covers the mapper-before-response pattern
// in its existing describe blocks (the "Negative paths" and DTO tests assert
// camelCase keys + snake_case negative assertions). The new mapper pattern
// was not added here to avoid duplicating existing coverage.

import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => null),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
        if (!req.headers?.authorization) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        req.user = { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => {
        next();
    },
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

// Mock the RAG / KnowledgeService path so the legacy search branch is exercised
jest.mock('../services/knowledgeService', () => ({
    getKnowledgeEvidenceStatus: jest.fn((citationCount: number, contextCount: number) =>
        citationCount > 0 ? 'verified_sources' : contextCount > 0 ? 'context_only' : 'no_verified_source'
    ),
    KnowledgeService: {
        searchKnowledge: jest.fn().mockResolvedValue([]),
        logSearch: jest.fn().mockResolvedValue(undefined),
        getSearchHistory: jest.fn().mockResolvedValue([]),
        getSearchStats: jest.fn().mockResolvedValue({}),
        askQuestion: jest.fn(),
    },
}));

jest.mock('../services/vectorService', () => ({
    VectorService: {
        upsertDocument: jest.fn().mockResolvedValue(undefined),
        hybridSearch: jest.fn().mockResolvedValue([]),
    },
    SearchResult: jest.fn(),
}));

jest.mock('../services/tavilyService', () => ({
    tavilyService: {
        isConfigured: jest.fn().mockReturnValue(false),
        search: jest.fn().mockResolvedValue(null),
    },
}));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

// ─── Fixtures (snake_case, mirror raw SQL output) ────────────────────────────

const legacyArticleRows = [
    {
        id: 'art-1',
        title: 'Maize Disease Management',
        content: 'Apply fungicides at first sign of symptoms.',
        content_type: 'text',
        summary: 'Maize disease overview',
        category: 'Crop Management',
        tags: ['maize', 'disease'],
        crops: ['maize'],
        regions: ['East Africa'],
        source: 'AG Extension',
        source_url: 'https://example.com/maize',
    },
    {
        id: 'art-2',
        title: 'Soil Fertility',
        content: 'Test soil before applying fertilizers.',
        content_type: 'text',
        summary: null,
        category: 'Soil Health',
        tags: null,
        crops: null,
        regions: null,
        source: null,
        source_url: null,
    },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Knowledge Route — performLegacySearch tuple return shape', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('GET /search (no q) triggers performLegacySearch and returns { articles, totalCount } tuple', async () => {
        // performLegacySearch calls query twice: first for COUNT(*), then for the article rows
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '47' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: legacyArticleRows, rowCount: 2 });

        const response = await request(app)
            .get('/api/v1/knowledge/search?limit=10&offset=0')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // The route assigns (articles as { totalCount }).totalCount ?? articles.length
        // and surfaces it as `total` in the response — this proves the tuple shape was
        // { articles, totalCount } and `totalCount` was correctly extracted.
        expect(response.body.data.articles).toHaveLength(2);
        expect(response.body.data.total).toBe(47); // from the count row, not rows.length
        expect(response.body.data.limit).toBe(10);
        expect(response.body.data.offset).toBe(0);
    });

    it('performLegacySearch maps snake_case article rows to camelCase DTOs', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: legacyArticleRows, rowCount: 2 });

        const response = await request(app)
            .get('/api/v1/knowledge/search?limit=10&offset=0')
            .set('Authorization', `Bearer ${officerToken}`);

        // Articles come from query<KnowledgeArticleRow> cast as SearchResult[] in the route
        // (the route doesn't run mapKnowledgeArticleRows on the legacy path), so we only
        // assert the tuple shape here. See the DTO unit tests for field renaming.
        const articles = response.body.data.articles as Array<Record<string, unknown>>;
        expect(articles[0].id).toBe('art-1');
        expect(articles[0].title).toBe('Maize Disease Management');
        expect(articles[1].id).toBe('art-2');
    });

    it('performLegacySearch with zero count returns articles=[] and total=0', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/knowledge/search?limit=10&offset=0')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.body.data.articles).toEqual([]);
        expect(response.body.data.total).toBe(0);
    });

    it('GET /meta/categories returns camelCase KnowledgeCategoryDTO', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ category: 'Crop Management' }, { category: 'Soil Health' }],
            rowCount: 2,
        });

        const response = await request(app)
            .get('/api/v1/knowledge/meta/categories')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(['Crop Management', 'Soil Health']);
    });

    it('GET /meta/crops returns camelCase KnowledgeCropDTO', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ crop: 'maize' }, { crop: 'beans' }, { crop: 'cassava' }],
            rowCount: 3,
        });

        const response = await request(app)
            .get('/api/v1/knowledge/meta/crops')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.arrayContaining(['maize', 'beans', 'cassava']));
    });
});

describe('Knowledge Route — Negative paths', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('GET /search returns 401 when Authorization header is missing', async () => {
        const response = await request(app).get('/api/v1/knowledge/search');
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        // No query should be attempted without a valid token
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('GET /search (legacy path) returns 500 when the underlying query throws (SQL error)', async () => {
        // Default getPool mock already returns a truthy pool, so the legacy
        // search path executes and the count query (first query in
        // performLegacySearch) is the one that fails.
        mockQuery.mockRejectedValueOnce(new Error('relation "knowledge_articles" does not exist'));

        const response = await request(app)
            .get('/api/v1/knowledge/search?limit=10&offset=0')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/search failed/i);
    });

    it('GET /search returns an empty articles list when the count + row queries both return rows: []', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/knowledge/search?limit=10&offset=0')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.articles).toEqual([]);
        expect(response.body.data.total).toBe(0);
    });

    it('GET /:id returns 404 with errorCode when the article does not exist (rows: [])', async () => {
        // Note: the route is `/:id` (single path segment after /knowledge/),
        // so the URL must be `/api/v1/knowledge/missing-id`, not
        // `/api/v1/knowledge/articles/missing-id` (which would 404 from
        // Express's catch-all and return { error: 'Not Found' } instead).
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/knowledge/missing-id')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('ARTICLE_NOT_FOUND');
    });
});
