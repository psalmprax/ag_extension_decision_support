import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getEmbedding } from '@/services/embeddingCache';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import { executeIlikeFallback, keywordSearch as runKeywordSearch } from '@/services/vector/keywordSearch';
import { addToRrfMap, mergeAndSortRrfResults } from '@/services/vector/rrfFusion';
import { backfillAllMissingEmbeddings as drainEmbeddings, backfillMissingEmbeddings as fillEmbeddingsBatch } from '@/services/vector/embeddingBackfill';

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
export class VectorService {
    /**
     * Upsert a document into the vector store (PostgreSQL)
     */
    static async upsertDocument(id: string, content: string, metadata: Record<string, unknown>): Promise<void> {
        logger.info(`Upserting document to persistent vector store: ${id}`);

        try {
            // Generate embedding (uses cache for repeated content)
            const embedding = await getEmbedding(content);
            // Convert to pgvector format: [val1,val2,val3]
            const vector = `[${embedding.join(',')}]`;

            await query(`
                INSERT INTO knowledge_articles (id, title, content, category, tags, crops, regions, source, source_url, content_type, embedding, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
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
                vector
            ]);
        } catch (error) {
            logger.error(`Failed to upsert document ${id} to DB:`, error);
            throw error;
        }
    }

    /**
     * Search for similar documents using pgvector or fallback function
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
            // Generate query embedding (uses cache for repeated queries)
            const embedding = await getEmbedding(normalizedQuery);

            // Convert to pgvector format: [val1,val2,val3]
            const vector = `[${embedding.join(',')}]`;

            const params: Array<string | number> = [vector];
            const where: string[] = ['embedding IS NOT NULL'];

            if (filters.category) {
                params.push(filters.category);
                where.push(`category = $${params.length}`);
            }

            if (filters.crop) {
                params.push(filters.crop);
                where.push(`$${params.length} = ANY(crops)`);
            }

            params.push(minScore);
            params.push(limit);

            // Use native pgvector cosine distance operator for O(log n) search with IVFFlat index
            // Only select needed columns — avoid fetching the large embedding vector
            const result = await query(`
                SELECT * FROM (
                    SELECT id, title, content, category, crops, source_url, content_type,
                           (1 - (embedding <=> $1::vector)) as score
                    FROM knowledge_articles
                    WHERE ${where.join(' AND ')}
                ) sub
                WHERE score >= $${params.length - 1}
                ORDER BY score DESC
                LIMIT $${params.length}
            `, params as unknown as unknown[]);

            type VectorRow = { id: string; content: string; title: unknown; category: unknown; crops: unknown[] | null; source_url: unknown; content_type: unknown; score: unknown };
            return (result.rows as unknown as VectorRow[]).map((row) => ({
                id: row.id,
                content: row.content,
                metadata: {
                    title: row.title,
                    category: row.category,
                    crop: Array.isArray(row.crops) ? row.crops[0] : undefined,
                    sourceUrl: row.source_url,
                    contentType: (row.content_type as string) || 'text'
                },
                score: Number.parseFloat(String(row.score ?? 0))
            }));
        } catch (error) {
            logger.error('Database vector search failed:', error);
            return [];
        }
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
     * Search using both vector and keyword search, merged using Reciprocal Rank Fusion (RRF)
     */
    static async hybridSearch(
        queryText: string,
        limit: number = 5,
        filters: VectorFilters = {},
        minScore: number = 0.4
    ): Promise<SearchResult[]> {
        logger.info(`Performing hybrid search (Vector + Keyword) for: "${queryText}"`);

        try {
            return await this.performHybridSearch(queryText, limit, filters);
        } catch (error) {
            logger.error('Hybrid search execution failed:', error);
            // Fall back to simple search on error
            return this.search(queryText, limit, filters, minScore);
        }
    }

    private static async performHybridSearch(
        queryText: string,
        limit: number,
        filters: VectorFilters
    ): Promise<SearchResult[]> {
        const [vectorResults, keywordResults] = await Promise.all([
            this.search(queryText, limit * 2, filters, 0.0),
            this.keywordSearch(queryText, limit * 2, filters)
        ]);

        if (vectorResults.length === 0 && keywordResults.length === 0) {
            return [];
        }

        const rrfMap = new Map<string, { doc: SearchResult; score: number }>();
        const k = 60;

        addToRrfMap(rrfMap, vectorResults, k);
        addToRrfMap(rrfMap, keywordResults, k, 0.5);

        return mergeAndSortRrfResults(rrfMap, limit);
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
                await this.upsertDocument(
                    article.id,
                    article.content,
                    {
                        title: article.title,
                        category: article.category,
                        tags: article.tags || [],
                        crops: [article.crop],
                        regions: article.regions || (article.crop === 'maize' ? ['East Africa'] : ['tropical']),
                        source: article.source || 'AG Extension Tropical Agronomy Seed',
                        sourceUrl: article.sourceUrl || null,
                        contentType: 'text'
                    }
                );
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
