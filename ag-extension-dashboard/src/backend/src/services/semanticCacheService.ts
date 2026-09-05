/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getEmbedding } from '@/services/embeddingCache';

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
            // 1. Generate embedding for the incoming query (uses cache)
            const embedding = await getEmbedding(queryText);
            const vector = `[${embedding.join(',')}]`;

            // 2. Search for most similar query using native pgvector operator
            // Order by similarity DESC to find the best match, not just the most recent
            const result = await query(`
                SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals,
                       (1 - (embedding <=> $1::vector)) as similarity
                FROM search_cache
                WHERE embedding IS NOT NULL
                  AND length(answer) >= 200
                  AND answer NOT LIKE '%AI assistant is currently unavailable%'
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
        if (!answer || typeof answer !== 'string' || answer.length < 200 || answer.includes('AI assistant is currently unavailable')) {
            logger.warn(`Skipping semantic cache save for low-quality or short answer (${answer?.length || 0} chars)`);
            return;
        }
        try {
            const embedding = await getEmbedding(queryText);
            const vector = `[${embedding.join(',')}]`;
            const normalized = queryText.trim().toLowerCase();

            await query(`
                INSERT INTO search_cache (query_text, normalized_query, answer, context_used, visuals, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (normalized_query) DO UPDATE SET
                    answer = EXCLUDED.answer,
                    context_used = EXCLUDED.context_used,
                    visuals = EXCLUDED.visuals,
                    embedding = EXCLUDED.embedding,
                    created_at = NOW()
            `, [queryText, normalized, answer, JSON.stringify(contextUsed), visuals ? JSON.stringify(visuals) : null, vector]);

            logger.info(`Stored new semantic cache entry for: "${queryText}"`);
        } catch (error) {
            logger.error('Failed to save semantic cache entry:', error);
        }
    }
}
