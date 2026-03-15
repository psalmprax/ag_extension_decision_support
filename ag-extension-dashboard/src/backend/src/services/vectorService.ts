import { AIRouter } from '@/services/aiProvider/aiProvider';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export interface VectorDocument {
    id: string;
    content: string;
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
    static async upsertDocument(id: string, content: string, metadata: Record<string, any>): Promise<void> {
        logger.info(`Upserting document to persistent vector store: ${id}`);

        try {
            // Generate embedding using ALFA
            const embeddingResult = await AIRouter.routeRequest('embed', { text: content });
            // Convert to PostgreSQL array format: {val1,val2,val3}
            const vector = `{${embeddingResult.embedding.join(',')}}`;

            await query(`
                INSERT INTO knowledge_articles (id, title, content, category, crops, embedding, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    category = EXCLUDED.category,
                    crops = EXCLUDED.crops,
                    embedding = EXCLUDED.embedding,
                    updated_at = NOW()
            `, [
                id,
                metadata.title || id,
                content,
                metadata.category,
                metadata.crops || [],
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
    static async search(queryText: string, limit: number = 5): Promise<SearchResult[]> {
        logger.info(`Searching persistent vector store for: "${queryText}"`);

        try {
            // Generate query embedding
            const queryEmbeddingResult = await AIRouter.routeRequest('embed', { text: queryText });
            // Convert to PostgreSQL array format: {val1,val2,val3}
            const vector = `{${queryEmbeddingResult.embedding.join(',')}}`;

            // Use our custom cosine_similarity function for maximum compatibility
            const result = await query(`
                SELECT id, title, content, category, crops, 
                       cosine_similarity(embedding::float8[], $1::float8[]) as score
                FROM knowledge_articles
                ORDER BY score DESC
                LIMIT $2
            `, [vector, limit]);

            return result.rows.map((row: any) => ({
                id: row.id,
                content: row.content,
                metadata: {
                    title: row.title,
                    category: row.category,
                    crop: row.crops?.[0]
                },
                score: parseFloat(row.score)
            }));
        } catch (error) {
            logger.error('Database vector search failed:', error);
            return [];
        }
    }

    /**
     * Seed initial knowledge into DB
     */
    static async seedKnowledge(articles: any[]): Promise<void> {
        logger.info(`Seeding persistent vector store with ${articles.length} articles`);
        for (const article of articles) {
            await this.upsertDocument(
                article.id,
                article.content,
                {
                    title: article.title,
                    category: article.category,
                    crops: [article.crop]
                }
            );
        }
    }
}
