import { AIRouter } from '@/services/aiProvider/aiProvider';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export interface CacheEntry {
    queryText: string;
    answer: string;
    contextUsed: any;
}

export class SemanticCacheService {
    /**
     * Try to find a similar query in the semantic cache
     * Threshold set to 0.95 for high accuracy matches
     */
    static async findSimilar(queryText: string, threshold: number = 0.95): Promise<CacheEntry | null> {
        try {
            // 1. Generate embedding for the incoming query
            const embeddingResult = await AIRouter.routeRequest('embed', { text: queryText });
            const vector = `{${embeddingResult.embedding.join(',')}}`;

            // 2. Search for similar queries in the cache table
            // We use cosine_similarity for vector comparison
            const result = await query(`
                SELECT query_text as "queryText", answer, context_used as "contextUsed",
                       cosine_similarity(embedding::float8[], $1::float8[]) as similarity
                FROM search_cache
                WHERE cosine_similarity(embedding::float8[], $1::float8[]) >= $2
                ORDER BY similarity DESC
                LIMIT 1
            `, [vector, threshold]);

            if (result.rows.length > 0) {
                logger.info(`Semantic cache HIT for query: "${queryText}" (Similarity: ${result.rows[0].similarity})`);
                return result.rows[0] as CacheEntry;
            }

            logger.info(`Semantic cache MISS for query: "${queryText}"`);
            return null;
        } catch (error) {
            logger.error('Semantic cache lookup failed:', error);
            return null;
        }
    }

    /**
     * Save a new result into the semantic cache
     */
    static async save(queryText: string, answer: string, contextUsed: any): Promise<void> {
        try {
            const embeddingResult = await AIRouter.routeRequest('embed', { text: queryText });
            const vector = `{${embeddingResult.embedding.join(',')}}`;

            await query(`
                INSERT INTO search_cache (query_text, answer, context_used, embedding, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (query_text) DO UPDATE SET
                    answer = EXCLUDED.answer,
                    context_used = EXCLUDED.context_used,
                    embedding = EXCLUDED.embedding,
                    created_at = NOW()
            `, [queryText, answer, JSON.stringify(contextUsed), vector]);

            logger.info(`Stored new semantic cache entry for: "${queryText}"`);
        } catch (error) {
            logger.error('Failed to save semantic cache entry:', error);
        }
    }
}
