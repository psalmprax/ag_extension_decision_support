/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getEmbedding } from '@/services/embeddingCache';
import { cosineDistance, embeddingWidthPredicate, toVectorLiteral } from '@/services/vector/vectorSql';

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

            // 2. Nearest cached query through the HNSW index; usability filters
            //    apply to the few nearest rows rather than to the whole table.
            const result = await query(`
                SELECT * FROM (
                    SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals,
                           1 - (${cosineDistance('embedding', 1)}) as similarity
                    FROM search_cache
                    WHERE ${embeddingWidthPredicate('embedding')}
                    ORDER BY ${cosineDistance('embedding', 1)}
                    LIMIT 10
                ) nearest
                WHERE length(answer) >= 200
                  AND answer NOT LIKE '%AI assistant is currently unavailable%'
                ORDER BY similarity DESC
                LIMIT 1
            `, [toVectorLiteral(embedding)]);

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
            const normalized = queryText.trim().toLowerCase();

            await query(`
                INSERT INTO search_cache (query_text, normalized_query, answer, context_used, visuals, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5, $6::double precision[], NOW())
                ON CONFLICT (normalized_query) DO UPDATE SET
                    answer = EXCLUDED.answer,
                    context_used = EXCLUDED.context_used,
                    visuals = EXCLUDED.visuals,
                    embedding = EXCLUDED.embedding,
                    created_at = NOW()
            `, [queryText, normalized, answer, JSON.stringify(contextUsed), visuals ? JSON.stringify(visuals) : null, embedding]);

            logger.info(`Stored new semantic cache entry for: "${queryText}"`);
        } catch (error) {
            logger.error('Failed to save semantic cache entry:', error);
        }
    }
}
