/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getEmbedding } from '@/services/embeddingCache';

export interface VectorDocument {
    id: string;
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: Record<string, any>;
    embedding?: number[];
}

export interface SearchResult extends VectorDocument {
    score: number;
}

export class VectorService {
    /**
     * Upsert a document into the vector store (PostgreSQL)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async upsertDocument(id: string, content: string, metadata: Record<string, any>): Promise<void> {
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

            const params: any[] = [vector];
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
            `, params);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return result.rows.map((row: any) => ({
                id: row.id,
                content: row.content,
                metadata: {
                    title: row.title,
                    category: row.category,
                    crop: row.crops?.[0],
                    sourceUrl: row.source_url,
                    contentType: row.content_type || 'text'
                },
                score: Number.parseFloat(row.score)
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

            const params: any[] = [cleanQuery];
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
            `, params);

            return result.rows.map((row: any) => ({
                id: row.id,
                content: row.content,
                metadata: {
                    title: row.title,
                    category: row.category,
                    crop: row.crops?.[0],
                    sourceUrl: row.source_url,
                    contentType: row.content_type || 'text'
                },
                score: Number.parseFloat(row.score)
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
            // Run both searches in parallel for faster response
            const [vectorResults, keywordResults] = await Promise.all([
                this.search(queryText, limit * 2, filters, 0.0),
                this.keywordSearch(queryText, limit * 2, filters)
            ]);

            if (vectorResults.length === 0 && keywordResults.length === 0) {
                return [];
            }

            // Reciprocal Rank Fusion (RRF)
            const k = 60;
            const rrfMap = new Map<string, { doc: SearchResult; score: number; cosineScore: number }>();

            vectorResults.forEach((doc, idx) => {
                const rank = idx + 1;
                rrfMap.set(doc.id, {
                    doc,
                    score: 1 / (k + rank),
                    cosineScore: doc.score
                });
            });

            keywordResults.forEach((doc, idx) => {
                const rank = idx + 1;
                const rrfWeight = 1 / (k + rank);
                const existing = rrfMap.get(doc.id);
                if (existing) {
                    existing.score += rrfWeight;
                    // Keep the cosine score
                } else {
                    rrfMap.set(doc.id, {
                        doc,
                        score: rrfWeight,
                        cosineScore: 0.5 // Default baseline score for keyword-only matches
                    });
                }
            });

            // Sort by RRF score descending, preserve RRF score as the relevance score
            const merged = Array.from(rrfMap.values())
                .sort((a, b) => b.score - a.score)
                .map(item => {
                    // Use the RRF fusion score (not cosine) as the final relevance score
                    item.doc.score = item.score;
                    return item.doc;
                });

            // Apply limit (minScore filtering is less meaningful for RRF scores which are small fractions)
            return merged.slice(0, limit);
        } catch (error) {
            logger.error('Hybrid search execution failed:', error);
            // Fall back to simple search on error
            return this.search(queryText, limit, filters, minScore);
        }
    }

    /**
     * Seed initial knowledge into DB
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async seedKnowledge(articles: any[]): Promise<void> {
        try {
            const countResult = await query(`SELECT COUNT(*)::integer as count FROM knowledge_articles`);
            const count = countResult.rows[0]?.count || 0;
            if (count >= 15) {
                logger.info(`Vector store already has ${count} articles. Skipping seeding.`);
                return;
            }
        } catch (err) {
            logger.warn(`Could not check knowledge_articles count (table might not exist yet):`, err);
        }

        logger.info(`Seeding persistent vector store with ${articles.length} articles`);
        for (const article of articles) {
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
        }
    }
}
