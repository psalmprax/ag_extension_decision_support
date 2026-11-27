import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getEmbedding } from '@/services/embeddingCache';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import { executeIlikeFallback, mapKeywordRows, keywordSearch as runKeywordSearch } from '@/services/vector/keywordSearch';
import { fuseRankedLegs, type RetrievalSignals } from '@/services/vector/rrfFusion';
import { cosineDistance, embeddingWidthPredicate, toVectorLiteral } from '@/services/vector/vectorSql';
import { backfillAllMissingEmbeddings as drainEmbeddings, backfillMissingEmbeddings as fillEmbeddingsBatch } from '@/services/vector/embeddingBackfill';
import { SEED_ARTICLE_SOURCE } from '@/services/knowledge/seedArticles';

export interface VectorDocument {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    embedding?: number[];
}

export interface SearchResult extends VectorDocument {
    score: number;
}

export type VectorFilters = { category?: string; crop?: string };

/**
 * Public facade for the persistent vector store (PostgreSQL + pgvector).
 * Keyword search and RRF fusion live in `services/vector/*`; this class
 * keeps the historical static API used by routes and workers.
 */
/** How many times a seed article is tried when the embedding provider is only slow. */
export const SEED_EMBED_ATTEMPTS = 3;

/**
 * Runs `embed`, trying again when the embedding provider timed out: one slow call to an
 * outside service should not leave a seed article without an embedding. Other errors
 * (a wrong key, wrong dimensions) fail at once, as retrying cannot help.
 */
export async function retryEmbeddingTimeouts(title: string, embed: () => Promise<unknown>): Promise<void> {
    for (let attempt = 1; ; attempt++) {
        try {
            await embed();
            return;
        } catch (err) {
            const timedOut = /timed out/i.test((err as Error)?.message ?? '');
            if (!timedOut || attempt >= SEED_EMBED_ATTEMPTS) throw err;
            logger.warn(`Vector seeding: embedding "${title}" timed out (attempt ${attempt} of ${SEED_EMBED_ATTEMPTS}), trying again`);
        }
    }
}

export class VectorService {
    /**
     * Upsert a document into the vector store (PostgreSQL)
     */
    static async upsertDocument(id: string, content: string, metadata: Record<string, unknown>): Promise<void> {
        logger.info(`Upserting document to persistent vector store: ${id}`);

        try {
            // Generate embedding (uses cache for repeated content)
            const embedding = await getEmbedding(content);
            await query(`
                INSERT INTO knowledge_articles (id, title, content, category, tags, crops, regions, source, source_url, content_type, embedding, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::double precision[], NOW())
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    category = EXCLUDED.category,
                    tags = EXCLUDED.tags,
                    crops = EXCLUDED.crops,
                    regions = EXCLUDED.regions,
                    source = EXCLUDED.source,
                    source_url = EXCLUDED.source_url,
                    content_type = EXCLUDED.content_type,
                    embedding = EXCLUDED.embedding,
                    updated_at = NOW()
            `, [
                id,
                metadata.title || id,
                content,
                metadata.category,
                metadata.tags || [],
                metadata.crops || [],
                metadata.regions || [],
                metadata.source || null,
                metadata.sourceUrl || null,
                metadata.contentType || 'text',
                embedding
            ]);
        } catch (error) {
            logger.error(`Failed to upsert document ${id} to DB:`, error);
            throw error;
        }
    }

    /**
     * Nearest articles by cosine similarity, through the HNSW index when the
     * configured width matches it. `score` and `metadata.retrieval.vectorSimilarity`
     * are the raw cosine similarity.
     */
    static async search(
        queryText: string,
        limit: number = 5,
        filters: VectorFilters = {},
        minScore: number = 0.4
    ): Promise<SearchResult[]> {
        const normalizedQuery = normalizeAgronomicQuery(queryText);
        logger.info(`Searching persistent vector store for: "${queryText}" (normalized: "${normalizedQuery}", minScore: ${minScore})`);

        try {
            const embedding = await getEmbedding(normalizedQuery);
            return await this.searchByEmbedding(embedding, limit, filters, minScore);
        } catch (error) {
            logger.error('Database vector search failed:', error);
            return [];
        }
    }

    /** Vector search with a precomputed query embedding. Throws on database errors. */
    static async searchByEmbedding(
        embedding: number[],
        limit: number,
        filters: VectorFilters = {},
        minScore: number = 0
    ): Promise<SearchResult[]> {
        const params: Array<string | number> = [toVectorLiteral(embedding)];
        const where: string[] = [embeddingWidthPredicate('embedding')];

        if (filters.category) {
            params.push(filters.category);
            where.push(`category = $${params.length}`);
        }

        if (filters.crop) {
            params.push(filters.crop);
            where.push(`$${params.length} = ANY(crops)`);
        }

        params.push(limit);
        const limitParam = params.length;
        params.push(minScore);

        // ORDER BY the indexed distance expression directly (not an alias or a
        // filtered subquery) so the planner can walk the HNSW index. An index
        // scan applies category/crop filters after it stops at hnsw.ef_search
        // rows, so a filtered search that comes back short is repeated exactly:
        // "+ 0" keeps the planner off the index and filters apply first.
        const nearest = (exact: boolean) => query(`
            SELECT * FROM (
                SELECT id, title, content, category, crops, tags, regions, updated_at, source, source_url, content_type,
                       1 - (${cosineDistance('embedding', 1)}) AS score
                FROM knowledge_articles
                WHERE ${where.join(' AND ')}
                ORDER BY ${exact ? `(${cosineDistance('embedding', 1)}) + 0` : cosineDistance('embedding', 1)}
                LIMIT $${limitParam}
            ) nearest
            WHERE score >= $${params.length}
            ORDER BY score DESC
        `, params);
        const filtered = Boolean(filters.category || filters.crop);
        let result = await nearest(false);
        if (filtered && result.rows.length < limit) result = await nearest(true);

        return mapKeywordRows(result.rows as unknown[]).map(row => ({
            ...row,
            metadata: { ...row.metadata, retrieval: { vectorSimilarity: row.score } satisfies RetrievalSignals },
        }));
    }

    /**
     * Search for knowledge articles using PostgreSQL full-text search (keyword-based)
     */
    static async keywordSearch(
        queryText: string,
        limit: number = 5,
        filters: VectorFilters = {}
    ): Promise<SearchResult[]> {
        return runKeywordSearch(queryText, limit, filters);
    }

    /** ILIKE fallback for queries with no usable full-text terms. */
    static async ilikeFallback(
        queryText: string,
        limit: number,
        filters: VectorFilters = {}
    ): Promise<SearchResult[]> {
        return executeIlikeFallback(queryText, limit, filters);
    }

    /**
     * Vector and keyword search fused with Reciprocal Rank Fusion (RRF).
     * `keywordQuery` lets a caller search the keyword leg with a different
     * phrasing (an English translation of a non-English question).
     */
    static async hybridSearch(
        queryText: string,
        limit: number = 5,
        filters: VectorFilters = {},
        minScore: number = 0.4,
        options: { keywordQuery?: string } = {}
    ): Promise<SearchResult[]> {
        logger.info(`Performing hybrid search (Vector + Keyword) for: "${queryText}"`);

        try {
            const [vectorResults, keywordResults] = await Promise.all([
                this.search(queryText, limit * 2, filters, 0.0),
                this.keywordSearch(options.keywordQuery || queryText, limit * 2, filters)
            ]);
            return fuseRankedLegs([
                { leg: 'vector', results: vectorResults },
                { leg: 'keyword', results: keywordResults },
            ], limit);
        } catch (error) {
            logger.error('Hybrid search execution failed:', error);
            return this.search(queryText, limit, filters, minScore);
        }
    }

    /**
     * Seed initial knowledge into DB
     */
    static async seedKnowledge(articles: Array<{ id: string; title: string; content: string; category: string; tags?: string[]; crop: string; regions?: string[]; source?: string; sourceUrl?: string | null }>): Promise<void> {
        // Determine which seed articles still need an embedding. The plain-SQL
        // seeder (routes/knowledge) inserts rows with embedding = NULL, so a simple
        // "count >= N → skip" check would leave vector search permanently empty.
        let pending = articles;
        try {
            const res = await query(
                `SELECT id FROM knowledge_articles WHERE id = ANY($1::uuid[]) AND embedding IS NOT NULL`,
                [articles.map(a => a.id)]
            );
            const embedded = new Set((res.rows as Array<{ id: string }>).map(r => r.id));
            pending = articles.filter(a => !embedded.has(a.id));
        } catch (err) {
            logger.warn(`Could not check embedded seed articles (table might not exist yet):`, err);
        }

        if (pending.length === 0) {
            logger.info(`Vector store: all ${articles.length} seed articles already embedded.`);
            return;
        }

        logger.info(`Seeding persistent vector store: embedding ${pending.length}/${articles.length} articles`);
        await this.embedPendingArticles(pending);
    }

    private static async embedPendingArticles(articles: Array<{ id: string; title: string; content: string; category: string; tags?: string[]; crop: string; regions?: string[]; source?: string; sourceUrl?: string | null }>): Promise<void> {        let failures = 0;
        for (const article of articles) {
            try {
                await retryEmbeddingTimeouts(article.title, () => this.upsertDocument(
                    article.id,
                    article.content,
                    {
                        title: article.title,
                        category: article.category,
                        tags: article.tags || [],
                        crops: [article.crop],
                        regions: article.regions || (article.crop === 'maize' ? ['East Africa'] : ['tropical']),
                        source: article.source || SEED_ARTICLE_SOURCE,
                        sourceUrl: article.sourceUrl || null,
                        contentType: 'text'
                    }
                ));
            } catch (err) {
                failures++;
                // A dimension mismatch will fail every article identically — stop early.
                if ((err as Error)?.name === 'EmbeddingDimensionError') {
                    logger.error(`Vector seeding aborted: ${(err as Error).message}`);
                    return;
                }
                logger.warn(`Vector seeding: failed to embed "${article.title}":`, err);
            }
        }
        if (failures > 0) logger.warn(`Vector seeding finished with ${failures} failure(s)`);
    }

    /**
     * Drain every NULL-embedding row in batches until none remain (or the provider
     * is misconfigured). Used by the boot sequence and the backfill CLI so large
     * existing corpora are indexed in one run rather than one batch per restart.
     */
    static async backfillAllMissingEmbeddings(batchSize = 100, maxBatches = 10_000): Promise<{ processed: number; failed: number; remaining: number; aborted?: string }> {
        return drainEmbeddings(batchSize, maxBatches, (id, content, metadata) => this.upsertDocument(id, content, metadata));
    }

    /**
     * Backfill embeddings for any knowledge_articles rows that lack one (e.g. rows
     * inserted by plain SQL seeders or ingestion paths that bypassed upsertDocument).
     */
    static async backfillMissingEmbeddings(batchSize = 50): Promise<{ processed: number; failed: number; aborted?: string }> {
        return fillEmbeddingsBatch(batchSize, (id, content, metadata) => this.upsertDocument(id, content, metadata));
    }
}
