import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getEmbedding } from '@/services/embeddingCache';

export interface VectorDocument {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    embedding?: number[];
}

export interface SearchResult extends VectorDocument {
    score: number;
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
        filters: { category?: string; crop?: string } = {},
        minScore: number = 0.4
    ): Promise<SearchResult[]> {
        logger.info(`Searching persistent vector store for: "${queryText}" (minScore: ${minScore})`);

        try {
            // Generate query embedding (uses cache for repeated queries)
            const embedding = await getEmbedding(queryText);

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
        filters: { category?: string; crop?: string } = {}
    ): Promise<SearchResult[]> {
        logger.info(`Searching database via keyword search for: "${queryText}"`);
        try {
            // Sanitize query text for tsquery - simple words split by &
            const cleanQuery = queryText
                .replace(/[^a-zA-Z0-9\s]/g, ' ')
                .trim()
                .split(/\s+/)
                .filter(word => word.length > 2)
                .join(' & ');

            if (!cleanQuery) {
                return [];
            }

            const params: Array<string | number> = [cleanQuery];
            const where: string[] = ["to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', $1)"];

            if (filters.category) {
                params.push(filters.category);
                where.push(`category = $${params.length}`);
            }

            if (filters.crop) {
                params.push(filters.crop);
                where.push(`$${params.length} = ANY(crops)`);
            }

            params.push(limit);

            const result = await query(`
                SELECT id, title, content, category, crops, source_url, content_type,
                       ts_rank_cd(to_tsvector('english', title || ' ' || content), to_tsquery('english', $1)) as score
                FROM knowledge_articles
                WHERE ${where.join(' AND ')}
                ORDER BY score DESC
                LIMIT $${params.length}
            `, params as unknown as unknown[]);

            type KeywordRow = { id: string; content: string; title: unknown; category: unknown; crops: unknown[] | null; source_url: unknown; content_type: unknown; score: unknown };
            return (result.rows as unknown as KeywordRow[]).map((row) => ({
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
            logger.error('Database keyword search failed:', error);
            return [];
        }
    }

    /**
     * Search using both vector and keyword search, merged using Reciprocal Rank Fusion (RRF)
     */
    static async hybridSearch(
        queryText: string,
        limit: number = 5,
        filters: { category?: string; crop?: string } = {},
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
        filters: { category?: string; crop?: string }
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

        this.addToRrfMap(rrfMap, vectorResults, k);
        this.addToRrfMap(rrfMap, keywordResults, k, 0.5);

        return this.mergeAndSortRrfResults(rrfMap, limit);
    }

    private static addToRrfMap(
        rrfMap: Map<string, { doc: SearchResult; score: number }>,
        results: SearchResult[],
        k: number,
        defaultScore: number = 0
    ): void {
        results.forEach((doc, idx) => {
            const rank = idx + 1;
            const rrfWeight = 1 / (k + rank);
            const existing = rrfMap.get(doc.id);
            if (existing) {
                existing.score += rrfWeight;
            } else {
                rrfMap.set(doc.id, {
                    doc,
                    score: rrfWeight + defaultScore
                });
            }
        });
    }

    private static mergeAndSortRrfResults(
        rrfMap: Map<string, { doc: SearchResult; score: number }>,
        limit: number
    ): SearchResult[] {
        return Array.from(rrfMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => {
                item.doc.score = item.score;
                return item.doc;
            });
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
        let failures = 0;
        for (const article of pending) {
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
     * Backfill embeddings for any knowledge_articles rows that lack one (e.g. rows
     * inserted by plain SQL seeders or ingestion paths that bypassed upsertDocument).
     */
    /**
     * Drain every NULL-embedding row in batches until none remain (or the provider
     * is misconfigured). Used by the boot sequence and the backfill CLI so large
     * existing corpora are indexed in one run rather than one batch per restart.
     */
    static async backfillAllMissingEmbeddings(batchSize = 100, maxBatches = 10_000): Promise<{ processed: number; failed: number; remaining: number; aborted?: string }> {
        let processed = 0;
        let failed = 0;
        let aborted: string | undefined;
        for (let i = 0; i < maxBatches; i++) {
            const r = await this.backfillMissingEmbeddings(batchSize);
            processed += r.processed;
            failed += r.failed;
            if (r.aborted) { aborted = r.aborted; break; }
            if (r.processed === 0 && r.failed === 0) break; // nothing left
            if (r.processed === 0 && r.failed > 0) break;   // every row in the batch failed — stop looping
        }
        let remaining = 0;
        try {
            const c = await query(`SELECT COUNT(*)::int AS n FROM knowledge_articles WHERE embedding IS NULL`);
            remaining = Number(c.rows[0]?.n ?? 0);
        } catch { /* table may not exist */ }
        return { processed, failed, remaining, aborted };
    }

    static async backfillMissingEmbeddings(batchSize = 50): Promise<{ processed: number; failed: number; aborted?: string }> {
        const result = await this.processEmbeddingBatch(batchSize);
        if (result.processed || result.failed) {
            logger.info(`Embedding backfill: ${result.processed} embedded, ${result.failed} failed`);
        }
        return result;
    }

    private static async processEmbeddingBatch(batchSize: number): Promise<{ processed: number; failed: number; aborted?: string }> {
        let processed = 0;
        const failed: number[] = [];
        let aborted: string | undefined;
        try {
            const rows = await this.fetchRowsMissingEmbeddings(batchSize);
            for (const row of rows) {
                try {
                    await this.processSingleEmbedding(row);
                    processed++;
                } catch {
                    failed.push(1);
                }
            }
        } catch (err) {
            logger.warn('Embedding backfill query failed:', err);
        }
        return { processed, failed: failed.length, aborted };
    }

    private static async fetchRowsMissingEmbeddings(batchSize: number): Promise<Array<Record<string, unknown>>> {
        const res = await query(
            `SELECT id, title, content, category, tags, crops, regions, source, source_url, content_type
               FROM knowledge_articles WHERE embedding IS NULL ORDER BY created_at ASC LIMIT $1`,
            [batchSize]
        );
        return res.rows as Array<Record<string, unknown>>;
    }

    private static async processSingleEmbedding(row: Record<string, unknown>): Promise<void> {
        try {
            await this.upsertDocument(String(row.id), String(row.content || ''), {
                title: row.title,
                category: row.category,
                tags: row.tags || [],
                crops: row.crops || [],
                regions: row.regions || [],
                source: row.source || null,
                sourceUrl: row.source_url || null,
                contentType: row.content_type || 'text',
            });
        } catch (err) {
            if ((err as Error)?.name === 'EmbeddingDimensionError') {
                throw err;
            }
        }
    }
}
