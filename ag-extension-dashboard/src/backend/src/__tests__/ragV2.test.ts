import { RAGV2Service } from '../services/ragV2Service';
import { QueryResult } from 'pg';

// Helper to create mock QueryResult objects
const mockResult = (rows: unknown[], rowCount = rows.length): QueryResult => ({
    rows,
    rowCount,
    fields: [],
    command: 'SELECT',
    oid: 0,
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/services/databaseService', () => ({
    query: jest.fn(),
}));

jest.mock('@/services/embeddingCache', () => ({
    getEmbedding: jest.fn(),
}));

jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIRouter: {
        routeRequest: jest.fn(),
    },
}));

jest.mock('@/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// ─── Imports after mocks ─────────────────────────────────────────────────────

import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { AIRouter } from '@/services/aiProvider/aiProvider';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetEmbedding = getEmbedding as jest.MockedFunction<typeof getEmbedding>;
const mockRouteRequest = AIRouter.routeRequest as jest.MockedFunction<typeof AIRouter.routeRequest>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fakeEmbedding(dim = 768): number[] {
    return Array.from({ length: dim }, () => Math.random());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RAGV2Service', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Entity Extraction ────────────────────────────────────────────────────

    describe('extractEntities', () => {
        it('extracts crop entities from text', () => {
            const text = 'Maize is commonly grown in East Africa alongside cassava and rice.';
            const entities = RAGV2Service.extractEntities(text, 'article-1');

            const cropEntities = Array.from(entities.values()).filter(e => e.type === 'crop');
            expect(cropEntities.length).toBeGreaterThanOrEqual(3);

            const names = cropEntities.map(e => e.name);
            expect(names).toContain('maize');
            expect(names).toContain('cassava');
            expect(names).toContain('rice');
        });

        it('extracts disease entities', () => {
            const text = 'Northern leaf blight and fall armyworm are major threats to maize.';
            const entities = RAGV2Service.extractEntities(text, 'article-2');

            const diseaseEntities = Array.from(entities.values()).filter(e => e.type === 'disease');
            expect(diseaseEntities.length).toBeGreaterThanOrEqual(2);

            const names = diseaseEntities.map(e => e.name);
            expect(names).toContain('northern leaf blight');
            expect(names).toContain('fall armyworm');
        });

        it('extracts soil entities', () => {
            const text = 'Sandy loam and clay loam soils have different water retention.';
            const entities = RAGV2Service.extractEntities(text, 'article-3');

            const soilEntities = Array.from(entities.values()).filter(e => e.type === 'soil');
            expect(soilEntities.length).toBeGreaterThanOrEqual(2);
        });

        it('extracts practice entities', () => {
            const text = 'Crop rotation and intercropping improve soil fertility. Conservation tillage reduces erosion.';
            const entities = RAGV2Service.extractEntities(text, 'article-4');

            const practiceEntities = Array.from(entities.values()).filter(e => e.type === 'practice');
            expect(practiceEntities.length).toBeGreaterThanOrEqual(2);
        });

        it('extracts nutrient entities', () => {
            const text = 'Apply nitrogen and phosphorus fertilizer. NPK is essential.';
            const entities = RAGV2Service.extractEntities(text, 'article-5');

            const nutrientEntities = Array.from(entities.values()).filter(e => e.type === 'nutrient');
            expect(nutrientEntities.length).toBeGreaterThanOrEqual(2);
        });

        it('deduplicates entities with same name', () => {
            const text = 'Maize grows well. Maize is a staple crop. Maize yields are high.';
            const entities = RAGV2Service.extractEntities(text, 'article-6');

            const cropEntities = Array.from(entities.values()).filter(e => e.type === 'crop');
            const maizeEntities = cropEntities.filter(e => e.name === 'maize');
            expect(maizeEntities).toHaveLength(1);
        });

        it('returns empty map for text with no recognized entities', () => {
            const text = 'The quick brown fox jumps over the lazy dog.';
            const entities = RAGV2Service.extractEntities(text, 'article-7');
            expect(entities.size).toBe(0);
        });

        it('generates correct entity IDs', () => {
            const text = 'Maize is a cereal crop.';
            const entities = RAGV2Service.extractEntities(text, 'article-8');

            const maize = Array.from(entities.values()).find(e => e.name === 'maize');
            expect(maize).toBeDefined();
            expect(maize!.id).toBe('crop:maize');
        });

        it('stores firstSeenIn article reference', () => {
            const text = 'Rice paddy cultivation.';
            const entities = RAGV2Service.extractEntities(text, 'article-9');

            const rice = Array.from(entities.values()).find(e => e.name === 'rice');
            expect(rice).toBeDefined();
            expect(rice!.properties.firstSeenIn).toBe('article-9');
        });
    });

    // ── Relationship Extraction ──────────────────────────────────────────────

    describe('extractRelationships', () => {
        it('creates crop-disease relationships', () => {
            const text = 'Maize is affected by northern leaf blight.';
            const entities = RAGV2Service.extractEntities(text, 'article-1');
            const rels = RAGV2Service.extractRelationships(entities, 'article-1');

            const cropDiseaseRels = rels.filter(r =>
                r.relationType === 'affected_by' || r.relationType === 'affects'
            );
            expect(cropDiseaseRels.length).toBeGreaterThanOrEqual(1);
        });

        it('creates crop-soil relationships', () => {
            const text = 'Cassava grows well in sandy loam soil.';
            const entities = RAGV2Service.extractEntities(text, 'article-2');
            const rels = RAGV2Service.extractRelationships(entities, 'article-2');

            const soilRels = rels.filter(r =>
                r.relationType === 'grows_in' || r.relationType === 'suitable_for'
            );
            expect(soilRels.length).toBeGreaterThanOrEqual(1);
        });

        it('creates bidirectional relationships', () => {
            const text = 'Maize requires nitrogen fertilizer.';
            const entities = RAGV2Service.extractEntities(text, 'article-3');
            const rels = RAGV2Service.extractRelationships(entities, 'article-3');

            // Should have both crop->nutrient and nutrient->crop
            const requires = rels.filter(r => r.relationType === 'requires');
            const neededBy = rels.filter(r => r.relationType === 'needed_by');
            expect(requires.length).toBeGreaterThanOrEqual(1);
            expect(neededBy.length).toBeGreaterThanOrEqual(1);
        });

        it('tags relationships with articleId', () => {
            const text = 'Rice blast is a disease.';
            const entities = RAGV2Service.extractEntities(text, 'article-4');
            const rels = RAGV2Service.extractRelationships(entities, 'article-4');

            for (const rel of rels) {
                // articleId is added at runtime but not in the interface
                expect((rel as any).articleId).toBe('article-4');
            }
        });

        it('marks co-occurrence in properties', () => {
            const text = 'Maize and cassava grow in East Africa.';
            const entities = RAGV2Service.extractEntities(text, 'article-5');
            const rels = RAGV2Service.extractRelationships(entities, 'article-5');

            for (const rel of rels) {
                expect(rel.properties.coOccurrence).toBe(true);
            }
        });

        it('returns empty array for single entity type', () => {
            const text = 'Maize is a crop. Another maize variety.';
            const entities = RAGV2Service.extractEntities(text, 'article-6');
            const rels = RAGV2Service.extractRelationships(entities, 'article-6');

            // Only crops — no inter-type relationships
            const uniqueTypes = new Set(Array.from(entities.values()).map(e => e.type));
            if (uniqueTypes.size <= 1) {
                expect(rels).toHaveLength(0);
            }
        });
    });

    // ── Chunking (via chunkAndEmbedArticle) ──────────────────────────────────

    describe('chunkAndEmbedArticle', () => {
        it('chunks long text and embeds each chunk', async () => {
            const longText = 'Maize farming practices for tropical regions. '.repeat(50); // ~2200 chars
            mockGetEmbedding.mockResolvedValue(fakeEmbedding());
            mockQuery.mockResolvedValue(mockResult([], 1));

            const count = await RAGV2Service.chunkAndEmbedArticle('art-1', longText, { title: 'Test' });

            expect(count).toBeGreaterThan(1);
            expect(mockGetEmbedding).toHaveBeenCalledTimes(count);
            // Each chunk gets an INSERT query
            expect(mockQuery).toHaveBeenCalledTimes(count + 1); // +1 for DELETE
        });

        it('returns 0 for empty content', async () => {
            const count = await RAGV2Service.chunkAndEmbedArticle('art-2', '', {});
            expect(count).toBe(0);
        });

        it('returns 1 for short content that fits in one chunk', async () => {
            const shortText = 'Maize is a cereal crop grown in tropical regions.';
            mockGetEmbedding.mockResolvedValue(fakeEmbedding());
            mockQuery.mockResolvedValue(mockResult([], 1));

            const count = await RAGV2Service.chunkAndEmbedArticle('art-3', shortText, {});
            expect(count).toBe(1);
        });

        it('deletes existing chunks before inserting new ones', async () => {
            mockGetEmbedding.mockResolvedValue(fakeEmbedding());
            mockQuery.mockResolvedValue(mockResult([], 1));

            await RAGV2Service.chunkAndEmbedArticle('art-4', 'Short text content here.', {});

            // First call should be DELETE
            const firstCall = mockQuery.mock.calls[0];
            expect(firstCall[0]).toContain('DELETE FROM knowledge_chunks');
            expect(firstCall[1]).toEqual(['art-4']);
        });

        it('continues if individual chunk embedding fails', async () => {
            const longText = 'Maize farming practices for tropical regions. '.repeat(50); // ~2200 chars
            mockGetEmbedding
                .mockResolvedValueOnce(fakeEmbedding())
                .mockRejectedValueOnce(new Error('Embedding failed'))
                .mockResolvedValueOnce(fakeEmbedding());
            mockQuery.mockResolvedValue(mockResult([], 1));

            const count = await RAGV2Service.chunkAndEmbedArticle('art-5', longText, {});
            expect(count).toBeGreaterThan(0);
        });
    });

    // ── Store Entities ───────────────────────────────────────────────────────

    describe('storeEntities', () => {
        it('upserts entities with ON CONFLICT', async () => {
            const entities = new Map();
            entities.set('crop:maize', {
                id: 'crop:maize',
                name: 'maize',
                type: 'crop',
                properties: { firstSeenIn: 'art-1' }
            });

            mockQuery.mockResolvedValue(mockResult([], 1));
            await RAGV2Service.storeEntities(entities);

            expect(mockQuery).toHaveBeenCalledTimes(1);
            const call = mockQuery.mock.calls[0];
            expect(call[0]).toContain('ON CONFLICT');
            expect(call[1]![0]).toBe('crop:maize');
        });
    });

    // ── Store Relationships ──────────────────────────────────────────────────

    describe('storeRelationships', () => {
        it('inserts relationships with ON CONFLICT DO NOTHING', async () => {
            const rels = [{
                sourceEntityId: 'crop:maize',
                targetEntityId: 'disease:blight',
                relationType: 'affected_by',
                articleId: 'art-1',
                properties: { coOccurrence: true }
            }];

            mockQuery.mockResolvedValue(mockResult([], 1));
            await RAGV2Service.storeRelationships(rels);

            expect(mockQuery).toHaveBeenCalledTimes(1);
            const call = mockQuery.mock.calls[0];
            expect(call[0]).toContain('ON CONFLICT DO NOTHING');
        });

        it('silently ignores duplicate key errors', async () => {
            const rels = [{
                sourceEntityId: 'crop:maize',
                targetEntityId: 'disease:blight',
                relationType: 'affected_by',
                articleId: 'art-1',
                properties: {}
            }];

            mockQuery.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

            // Should not throw
            await expect(RAGV2Service.storeRelationships(rels)).resolves.toBeUndefined();
        });
    });

    // ── Search Chunks ────────────────────────────────────────────────────────

    describe('searchChunks', () => {
        it('returns ranked results from chunk search', async () => {
            mockGetEmbedding.mockResolvedValue(fakeEmbedding());
            mockQuery.mockResolvedValue(mockResult([
                    {
                        id: 'art-1-chunk-0',
                        article_id: 'art-1',
                        content: 'Maize farming best practices',
                        chunk_index: 0,
                        title: 'Maize Guide',
                        category: 'Crop Management',
                        source: 'AG Extension',
                        source_url: 'https://example.com',
                        crops: ['maize'],
                        score: 0.85
                    }
                ], 1));

            const results = await RAGV2Service.searchChunks('maize farming', 5);

            expect(results).toHaveLength(1);
            expect(results[0].articleId).toBe('art-1');
            expect(results[0].score).toBe(0.85);
            expect(results[0].citation).toContain('Maize Guide');
        });

        it('returns empty array on error', async () => {
            mockGetEmbedding.mockRejectedValue(new Error('Embedding service down'));

            const results = await RAGV2Service.searchChunks('test query', 5);
            expect(results).toEqual([]);
        });
    });

    // ── Re-ranking ───────────────────────────────────────────────────────────

    describe('rerank', () => {
        it('returns results unchanged if only one result', async () => {
            const results = [{
                id: '1',
                articleId: 'art-1',
                content: 'test',
                metadata: {},
                score: 0.8,
                citation: 'test'
            }];

            const ranked = await RAGV2Service.rerank('query', results, 5);
            expect(ranked).toEqual(results);
        });

        it('re-ranks results using LLM scores', async () => {
            const results = Array.from({ length: 5 }, (_, i) => ({
                id: `${i}`,
                articleId: `art-${i}`,
                content: `Content about topic ${i}`,
                metadata: { title: `Article ${i}` },
                score: 0.5 - i * 0.05,
                citation: `Article ${i}`
            }));

            mockRouteRequest.mockResolvedValue(
                JSON.stringify([
                    { idx: 2, score: 9 },
                    { idx: 0, score: 7 },
                    { idx: 1, score: 5 },
                    { idx: 3, score: 3 },
                    { idx: 4, score: 1 }
                ])
            );

            const ranked = await RAGV2Service.rerank('query', results, 3);

            expect(ranked).toHaveLength(3);
            // Highest rerank score should be first
            expect(ranked[0].articleId).toBe('art-2');
        });

        it('falls back to original order if LLM fails', async () => {
            const results = Array.from({ length: 3 }, (_, i) => ({
                id: `${i}`,
                articleId: `art-${i}`,
                content: `Content ${i}`,
                metadata: {},
                score: 0.8 - i * 0.1,
                citation: `Article ${i}`
            }));

            mockRouteRequest.mockRejectedValue(new Error('LLM unavailable'));

            const ranked = await RAGV2Service.rerank('query', results, 3);
            expect(ranked).toHaveLength(3);
            // Should fall back to original order
            expect(ranked[0].articleId).toBe('art-0');
        });
    });

    // ── Schema Initialization ────────────────────────────────────────────────

    describe('initializeSchema', () => {
        it('creates tables and indexes', async () => {
            mockQuery.mockResolvedValue(mockResult([], 0));

            await RAGV2Service.initializeSchema();

            expect(mockQuery).toHaveBeenCalledTimes(1);
            const sql = mockQuery.mock.calls[0][0] as string;
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS knowledge_chunks');
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS knowledge_entities');
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS knowledge_relationships');
            expect(sql).toContain('vector(768)');
        });

        it('handles errors gracefully', async () => {
            mockQuery.mockRejectedValue(new Error('Permission denied'));

            // Should not throw
            await expect(RAGV2Service.initializeSchema()).resolves.toBeUndefined();
        });
    });

    // ── Bootstrap ────────────────────────────────────────────────────────────

    describe('bootstrap', () => {
        it('runs full bootstrap pipeline', async () => {
            // Mock empty articles table (no articles to chunk)
            mockQuery
                .mockResolvedValueOnce(mockResult([], 0)) // initializeSchema
                .mockResolvedValueOnce(mockResult([], 0)) // chunkAllArticles - SELECT
                .mockResolvedValueOnce(mockResult([], 0)) // buildKnowledgeGraph - SELECT
                ;

            await RAGV2Service.bootstrap();

            // Should have called query for schema, chunking, and graph building
            expect(mockQuery).toHaveBeenCalled();
        });
    });
});
