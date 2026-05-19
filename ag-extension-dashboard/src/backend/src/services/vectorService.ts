/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

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
            // Generate embedding using ALFA
            const embeddingResult = await AIRouter.routeRequest('embed', { text: content });
            // Convert to PostgreSQL array format: {val1,val2,val3}
            const vector = `{${embeddingResult.embedding.join(',')}}`;

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
    static async search(queryText: string, limit: number = 5, filters: { category?: string; crop?: string } = {}): Promise<SearchResult[]> {
        logger.info(`Searching persistent vector store for: "${queryText}"`);

        try {
            // Generate query embedding
            const queryEmbeddingResult = await AIRouter.routeRequest('embed', { text: queryText });
            // Convert to PostgreSQL array format: {val1,val2,val3}
            const vector = `{${queryEmbeddingResult.embedding.join(',')}}`;

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

            params.push(limit);

            // Use our custom cosine_similarity function for maximum compatibility
            const result = await query(`
                SELECT id, title, content, category, crops, source_url, content_type,
                       cosine_similarity(embedding::float8[], $1::float8[]) as score
                FROM knowledge_articles
                WHERE ${where.join(' AND ')}
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
                    contentType: row.content_type
                },
                score: Number.parseFloat(row.score)
            }));
        } catch (error) {
            logger.error('Database vector search failed:', error);
            return [];
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
