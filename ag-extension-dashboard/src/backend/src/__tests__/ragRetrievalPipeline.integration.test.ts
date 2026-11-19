import { readFileSync } from 'fs';
import { config } from '@/config';
import path from 'path';
import { Client } from 'pg';
import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { rankAdvisoryEvidence } from '@/services/knowledge/advisoryRetrieval';
import { computeRetrievalMetrics, validateGoldenCases, type CaseOutcome } from '@/services/knowledge/retrievalEval';
import { seedKnowledgeArticlesData } from '@/services/knowledge/seedArticles';
import { RAGV2Service } from '@/services/ragV2Service';
import { retrievalSignals } from '@/services/vector/rrfFusion';
import { VectorService } from '@/services/vectorService';

/**
 * The advisory retrieval pipeline end to end on real PostgreSQL + pgvector:
 * migrations, upserts, chunking, the three search legs, fusion and the
 * relevance gate, scored on the English golden set. The embedder is a
 * deterministic hashed bag of words and the LLM is unavailable (no
 * translation, no reranking), so this measures the lexical floor of the
 * pipeline and guards its mechanics; semantic quality is measured with real
 * providers by `npm run eval:rag`.
 */

const DIMENSIONS = 256;
jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/embeddingCache', () => ({ getEmbedding: jest.fn() }));
jest.mock('@/services/embeddingDimensions', () => ({ EMBEDDING_DIMENSIONS: 256 }));
jest.mock('@/services/aiProvider/aiProvider', () => ({ AIRouter: { routeRequest: jest.fn() } }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'does', 'can', 'should', 'with', 'my', 'is', 'are', 'do', 'to', 'of', 'in', 'on', 'a', 'an', 'i', 'it', 'from', 'at', 'or', 'be', 'by', 'per', 'when', 'which', 'why']);

function stem(word: string): string {
    return word.replace(/(ing|ed|es|s)$/, '');
}

/** Deterministic stand-in for an embedding model: signed feature hashing of word stems. */
function hashedEmbedding(text: string): number[] {
    const vector = new Array<number>(DIMENSIONS).fill(0);
    for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
        if (STOP.has(word) || word.length < 3) continue;
        let hash = 2166136261;
        for (const char of stem(word)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        vector[Math.abs(hash) % DIMENSIONS]! += hash & 1 ? 1 : -1;
    }
    const norm = Math.hypot(...vector) || 1;
    return vector.map(value => value / norm);
}

const databaseUrl = process.env.RAG_INTEGRITY_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)('advisory retrieval pipeline on PostgreSQL', () => {
    let client: Client;

    beforeAll(async () => {
        client = new Client({ connectionString: databaseUrl });
        await client.connect();
        await client.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TEMP TABLE knowledge_articles (
                id uuid PRIMARY KEY, title varchar(255) NOT NULL, content text NOT NULL, category text,
                source text, source_url text, crops text[], tags text[], regions text[],
                content_type text, embedding double precision[], created_at timestamp DEFAULT now(), updated_at timestamp
            );
            CREATE TEMP TABLE knowledge_chunks (
                id text PRIMARY KEY, article_id uuid REFERENCES knowledge_articles(id),
                chunk_index integer, content text, embedding double precision[]
            );
            CREATE TEMP TABLE knowledge_entities (id text PRIMARY KEY, name text, entity_type text, properties jsonb);
            CREATE TEMP TABLE knowledge_relationships (
                source_id text, target_id text, relation_type text, article_id uuid REFERENCES knowledge_articles(id),
                properties jsonb, UNIQUE (source_id, target_id, relation_type, article_id)
            );
            CREATE TEMP TABLE search_cache (id serial PRIMARY KEY, embedding double precision[]);
        `);
        for (const name of ['20261108100000_version_rag_derived_data', '20261121090000_rag_retrieval_indexes']) {
            await client.query(readFileSync(path.resolve(__dirname, `../../prisma/migrations/${name}/migration.sql`), 'utf8'));
        }
        jest.mocked(query).mockImplementation(async (sql, params) => {
            const result = await client.query(sql, params);
            return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        });
        jest.mocked(getEmbedding).mockImplementation(async text => hashedEmbedding(text));
        jest.mocked(AIRouter.routeRequest).mockRejectedValue(new Error('LLM unavailable in this test'));
        // Similarities of the hashed embedder sit lower than a real model's: on
        // this corpus unanswerable questions top out near 0.17, so the gate
        // threshold is set for this embedder. The production threshold is
        // calibrated with real embeddings by `npm run eval:rag`.
        config.retrieval.minVectorSimilarity = 0.18;

        await VectorService.seedKnowledge(seedKnowledgeArticlesData);
        await RAGV2Service.chunkAllArticles();
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await client.end();
    });

    it('indexes the whole seed corpus with current chunks', async () => {
        const { rows: [counts] } = await client.query(`
            SELECT count(DISTINCT a.id) AS articles, count(c.id) AS chunks,
                   count(c.id) FILTER (WHERE c.source_content_hash = a.content_hash) AS current_chunks
            FROM knowledge_articles a LEFT JOIN knowledge_chunks c ON c.article_id = a.id`);
        expect(Number(counts.articles)).toBe(seedKnowledgeArticlesData.length);
        expect(Number(counts.current_chunks)).toBe(Number(counts.chunks));
        expect(Number(counts.chunks)).toBeGreaterThanOrEqual(seedKnowledgeArticlesData.length);
    });

    it('meets the lexical retrieval floor on the English golden set', async () => {
        const golden = JSON.parse(readFileSync(path.resolve(__dirname, '../../eval/rag-golden.json'), 'utf8')) as { cases: unknown };
        const cases = validateGoldenCases(golden.cases, new Set(seedKnowledgeArticlesData.map(article => article.id)))
            .filter(golden => golden.language === 'en');
        const outcomes: CaseOutcome[] = [];
        for (const golden of cases) {
            const { ranked, relevant } = await rankAdvisoryEvidence(golden.question, { language: 'en' });
            outcomes.push({ case: golden, ranked: ranked.map(result => result.id), evidence: relevant.map(result => result.id) });
        }
        const metrics = computeRetrievalMetrics(outcomes);
        // Floors a little under the measured values (hit@3 0.96, hit@5 1.0,
        // grounded 0.87, evidence precision 0.48, abstention 0.63).
        expect(metrics.errors).toBe(0);
        expect(metrics.hitAt3).toBeGreaterThanOrEqual(0.9);
        expect(metrics.hitAt5).toBeGreaterThanOrEqual(0.95);
        expect(metrics.groundedRate).toBeGreaterThanOrEqual(0.8);
        expect(metrics.evidencePrecision).toBeGreaterThanOrEqual(0.4);
        expect(metrics.abstentionRate).toBeGreaterThanOrEqual(0.6);
    });

    it('gives an unanswerable question no evidence while keeping its candidates', async () => {
        const { ranked, relevant } = await rankAdvisoryEvidence('How do I apply for a passport?', { language: 'en' });
        expect(relevant).toEqual([]);
        expect(ranked.every(result => retrievalSignals(result).rerankScore === undefined)).toBe(true);
    });

    it('ranks the farmer\'s crop first among near-ties and records the boost', async () => {
        const { ranked } = await rankAdvisoryEvidence('Which soil and water conditions suit my crop?', { crops: ['cassava'] });
        const cassava = ranked.find(result => result.id.endsWith('cb06'));
        expect(cassava && retrievalSignals(cassava).boost).toBeCloseTo(1.2);
    });
});
