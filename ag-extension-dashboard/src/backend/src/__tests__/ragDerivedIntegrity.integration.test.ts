import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { RAGV2Service } from '@/services/ragV2Service';
import { VectorService } from '@/services/vectorService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/embeddingCache', () => ({ getEmbedding: jest.fn() }));
jest.mock('@/services/embeddingDimensions', () => ({ EMBEDDING_DIMENSIONS: 3 }));
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
            CREATE TEMP TABLE search_cache (id serial PRIMARY KEY, embedding vector(3));
        `);
        // Legacy state: columns converted to pgvector by the old boot-time DDL.
        // The retrieval-index migration must bring them back to double precision[].
        for (const name of ['20261108100000_version_rag_derived_data', '20261121090000_rag_retrieval_indexes']) {
            const migration = readFileSync(path.resolve(__dirname, `../../prisma/migrations/${name}/migration.sql`), 'utf8');
            await client.query(migration);
            await client.query(migration);
        }
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
             VALUES ('legacy', $1, 0, 'old unversioned content', '{1,0,0}')`,
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

        // No current chunk exists: retrieval falls back to the article itself (full-text leg).
        const result = await RAGV2Service.enhancedSearch('rice', { useChunks: true, useGraph: false, useReranking: false });
        expect(result.results[0].content).toBe(newContent);
        expect(result.citations[0].excerpt).toBe(newContent);

        expect(await RAGV2Service.chunkAndEmbedArticle(articleId, newContent, {})).toBe(1);
        await RAGV2Service.buildKnowledgeGraph();
        expect((await RAGV2Service.searchChunks('rice'))[0].content).toBe(newContent);
        expect((await RAGV2Service.getRelatedEntities('rice')).some(entity => entity.name === 'powdery mildew')).toBe(true);
    });

    it('normalizes legacy vector columns and searches the stored arrays', async () => {
        const { rows } = await client.query(`
            SELECT c.relname, format_type(a.atttypid, a.atttypmod) AS type
            FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
            WHERE a.attname = 'embedding' AND a.attrelid IN (to_regclass('knowledge_articles'), to_regclass('knowledge_chunks'), to_regclass('search_cache'))
            ORDER BY 1`);
        expect(rows).toEqual([
            { relname: 'knowledge_articles', type: 'double precision[]' },
            { relname: 'knowledge_chunks', type: 'double precision[]' },
            { relname: 'search_cache', type: 'double precision[]' },
        ]);
        const id = '4d1841df-0ce6-4fd8-86f3-f66454a121cd';
        const content = 'Cassava nitrogen evidence for array storage.';
        await VectorService.upsertDocument(id, content, { title: 'Evidence', category: 'storage', crops: ['cassava'] });
        const [hit] = await VectorService.search('cassava', 5, { category: 'storage' });
        expect(hit.content).toBe(content);
        expect(hit.metadata.retrieval).toEqual({ vectorSimilarity: 1 });
        expect(await RAGV2Service.chunkAndEmbedArticle(id, content, { title: 'Evidence' })).toBe(1);
        expect((await RAGV2Service.searchChunks('cassava', 5, { category: 'storage' }))[0].content).toBe(content);
        const { rows: [stored] } = await client.query('SELECT content_hash = encode(sha256(convert_to(content, \'UTF8\')), \'hex\') AS current FROM knowledge_articles WHERE id = $1', [id]);
        expect(stored.current).toBe(true);
    });
});
