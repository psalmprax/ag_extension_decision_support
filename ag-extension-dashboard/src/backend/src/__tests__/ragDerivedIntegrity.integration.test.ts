import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { RAGV2Service } from '@/services/ragV2Service';
import { VectorService } from '@/services/vectorService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/embeddingCache', () => ({ getEmbedding: jest.fn() }));
jest.mock('@/services/aiProvider/aiProvider', () => ({ AIRouter: { routeRequest: jest.fn() } }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const databaseUrl = process.env.RAG_INTEGRITY_TEST_DATABASE_URL;
const articleId = 'c42d8782-ed7c-4c62-9f48-6521d54455c8';
const oldContent = 'Maize and northern leaf blight occur in this article.';
const newContent = 'Rice and powdery mildew occur in the updated article.';

(databaseUrl ? describe : describe.skip)('RAG derived data integrity with PostgreSQL', () => {
    let client: Client;

    beforeAll(async () => {
        client = new Client({ connectionString: databaseUrl });
        await client.connect();
        await client.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TEMP TABLE knowledge_articles (
                id uuid PRIMARY KEY, title text, content text NOT NULL, category text,
                source text, source_url text, crops text[], tags text[], regions text[],
                content_type text, embedding vector(3), updated_at timestamp
            );
            CREATE TEMP TABLE knowledge_chunks (
                id text PRIMARY KEY, article_id uuid REFERENCES knowledge_articles(id),
                chunk_index integer, content text, embedding vector(3)
            );
            CREATE TEMP TABLE knowledge_entities (
                id text PRIMARY KEY, name text, entity_type text, properties jsonb
            );
            CREATE TEMP TABLE knowledge_relationships (
                source_id text, target_id text, relation_type text, article_id uuid REFERENCES knowledge_articles(id),
                properties jsonb, UNIQUE (source_id, target_id, relation_type, article_id)
            );
        `);
        const migration = readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261108100000_version_rag_derived_data/migration.sql'), 'utf8');
        await client.query(migration);
        await client.query(migration);
        jest.mocked(query).mockImplementation(async (sql, params) => {
            const result = await client.query(sql, params);
            return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        });
        jest.mocked(getEmbedding).mockResolvedValue([1, 0, 0]);
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await client.end();
    });

    it('excludes legacy, stale, and in-flight outdated derived data while falling back to the current article', async () => {
        await client.query(
            `INSERT INTO knowledge_articles (id, title, content, category, crops, tags, regions)
             VALUES ($1, 'Guide', $2, 'crops', ARRAY['maize'], ARRAY[]::text[], ARRAY[]::text[])`,
            [articleId, oldContent]
        );
        await client.query(
            `INSERT INTO knowledge_chunks (id, article_id, chunk_index, content, embedding)
             VALUES ('legacy', $1, 0, 'old unversioned content', '[1,0,0]')`,
            [articleId]
        );
        expect(await RAGV2Service.searchChunks('maize')).toEqual([]);

        expect(await RAGV2Service.chunkAndEmbedArticle(articleId, oldContent, {})).toBe(1);
        await RAGV2Service.buildKnowledgeGraph();
        await client.query(
            `INSERT INTO knowledge_relationships (source_id, target_id, relation_type, article_id, properties, source_content_hash)
             VALUES ('crop:maize', 'disease:northern leaf blight', 'treats', $1, '{}',
                 encode(sha256(convert_to($2::text, 'UTF8')), 'hex'))`,
            [articleId, oldContent]
        );
        expect((await RAGV2Service.searchChunks('maize', 5, { crop: 'maize' }))[0].content).toBe(oldContent);
        expect(await RAGV2Service.searchChunks('maize', 5, { crop: 'rice' })).toEqual([]);
        const related = await RAGV2Service.getRelatedEntities('maize');
        expect(related.some(entity => entity.name === 'northern leaf blight' && entity.properties.viaRelation === 'co_occurs_with')).toBe(true);
        expect(related.some(entity => entity.properties.viaRelation === 'treats')).toBe(false);

        let resumeEmbedding!: (embedding: number[]) => void;
        let embeddingStarted!: () => void;
        const started = new Promise<void>(resolve => { embeddingStarted = resolve; });
        jest.mocked(getEmbedding).mockImplementationOnce(() => {
            embeddingStarted();
            return new Promise<number[]>(resolve => { resumeEmbedding = resolve; });
        });
        const pending = RAGV2Service.chunkAndEmbedArticle(articleId, oldContent, {});
        await started;
        await client.query('UPDATE knowledge_articles SET content = $2, crops = ARRAY[\'rice\'] WHERE id = $1', [articleId, newContent]);
        resumeEmbedding([1, 0, 0]);
        await expect(pending).rejects.toThrow('changed during chunk indexing');
        expect(await RAGV2Service.searchChunks('maize')).toEqual([]);
        expect((await RAGV2Service.getRelatedEntities('maize')).some(entity => entity.name === 'northern leaf blight')).toBe(false);
        await expect(RAGV2Service.chunkAndEmbedArticle(articleId, oldContent, {})).rejects.toThrow('changed during chunk indexing');
        const oldRelations = RAGV2Service.extractRelationships(RAGV2Service.extractEntities(oldContent, articleId), articleId);
        await expect(RAGV2Service.storeRelationships(oldRelations, oldContent)).rejects.toThrow('changed during graph indexing');

        jest.spyOn(VectorService, 'hybridSearch').mockResolvedValue([{
            id: articleId, content: newContent, metadata: { title: 'Guide', category: 'crops' }, score: 0.8,
        }]);
        const result = await RAGV2Service.enhancedSearch('rice', { useChunks: true, useGraph: false, useReranking: false });
        expect(result.results[0].content).toBe(newContent);
        expect(result.citations[0].excerpt).toBe(newContent);
        jest.mocked(VectorService.hybridSearch).mockRestore();

        expect(await RAGV2Service.chunkAndEmbedArticle(articleId, newContent, {})).toBe(1);
        await RAGV2Service.buildKnowledgeGraph();
        expect((await RAGV2Service.searchChunks('rice'))[0].content).toBe(newContent);
        expect((await RAGV2Service.getRelatedEntities('rice')).some(entity => entity.name === 'powdery mildew')).toBe(true);
    });

    it.each(['vector', 'array'])('writes and searches %s-backed embeddings', async storage => {
        if (storage === 'array') {
            await client.query(`
                ALTER TABLE knowledge_articles ALTER COLUMN embedding TYPE double precision[] USING embedding::real[]::double precision[];
                ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE double precision[] USING embedding::real[]::double precision[];
            `);
        }
        const id = storage === 'vector' ? 'a1f96d30-4c44-4cc7-92a5-d6bad48b0425' : '4d1841df-0ce6-4fd8-86f3-f66454a121cd';
        const content = `Cassava nitrogen evidence for ${storage} storage.`;
        await VectorService.upsertDocument(id, content, { title: 'Evidence', category: storage, crops: ['cassava'] });
        expect((await VectorService.search('cassava', 5, { category: storage }))[0].content).toBe(content);
        expect(await RAGV2Service.chunkAndEmbedArticle(id, content, {})).toBe(1);
        expect((await RAGV2Service.searchChunks('cassava', 5, { category: storage }))[0].content).toBe(content);
    });
});
