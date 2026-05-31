/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export interface CacheEntry {
    queryText: string;
    answer: string;
    contextUsed: any;
    visuals?: any;
}

export class SemanticCacheService {
    /**
     * Try to find a similar query in the semantic cache
     * Threshold lowered to 0.85 for "fuzzy" semantic matching
     */
    static async findSimilar(queryText: string, threshold: number = 0.85): Promise<CacheEntry | null> {
        try {
            // 1. Generate embedding for the incoming query
            const embeddingResult = await AIRouter.routeRequest('embed', { text: queryText });
            const vector = `{${embeddingResult.embedding.join(',')}}`;

            // 2. Search for most similar query using cosine_similarity
            // Order by similarity DESC to find the best match, not just the most recent
            const result = await query(`
                SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals,
                       cosine_similarity(embedding::float8[], $1::float8[]) as similarity
                FROM search_cache
                WHERE embedding IS NOT NULL
                ORDER BY similarity DESC
                LIMIT 1
            `, [vector]);

            if (result.rows.length > 0 && parseFloat(result.rows[0].similarity) >= threshold) {
                logger.info(`Semantic cache HIT for query: "${queryText}" (Similarity: ${result.rows[0].similarity})`);
                return result.rows[0] as CacheEntry;
            }

            logger.info(`Semantic cache MISS for query: "${queryText}" (Best similarity: ${result.rows[0]?.similarity || 0})`);
            return null;
        } catch (error) {
            logger.error('Semantic cache lookup failed:', error);
            return null;
        }
    }

    /**
     * Save a new result into the semantic cache
     */
    static async save(queryText: string, answer: string, contextUsed: any, visuals?: any): Promise<void> {
        try {
            const embeddingResult = await AIRouter.routeRequest('embed', { text: queryText });
            const vector = `{${embeddingResult.embedding.join(',')}}`;

            await query(`
                INSERT INTO search_cache (query_text, answer, context_used, visuals, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (query_text) DO UPDATE SET
                    answer = EXCLUDED.answer,
                    context_used = EXCLUDED.context_used,
                    visuals = EXCLUDED.visuals,
                    embedding = EXCLUDED.embedding,
                    created_at = NOW()
            `, [queryText, answer, JSON.stringify(contextUsed), visuals ? JSON.stringify(visuals) : null, vector]);

            logger.info(`Stored new semantic cache entry for: "${queryText}"`);
        } catch (error) {
            logger.error('Failed to save semantic cache entry:', error);
        }
    }
}
