/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import type { SearchResult } from '@/services/vectorService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { cacheGet, cacheSet, cacheDelete } from '@/services/cacheService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import type { KnowledgeAttachment } from '@/services/knowledge/types';

/**
 * Layered answer-cache lookups: Redis exact match → Postgres exact match →
 * semantic vector cache. Real-time intents skip the semantic layer.
 */

export async function checkCaches(
    queryText: string,
    redisKey: string
): Promise<(ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }) | null> {
    // A. Check Redis
    const cachedResponse = await cacheGet(redisKey);
    if (cachedResponse) {
        try {
            const parsed = JSON.parse(cachedResponse);
            if (parsed.answer && typeof parsed.answer === 'string' && parsed.answer.length >= 200 && !parsed.answer.includes('AI assistant is currently unavailable')) {
                logger.info(`Redis exact match HIT for query: "${queryText}"`);
                return { ...parsed, cached: true };
            } else {
                logger.warn(`Evicting short or poisoned Redis cache entry for query: "${queryText}"`);
                await cacheDelete(redisKey);
            }
        } catch (e) {
            logger.error('Failed to parse cached Redis response:', e);
        }
    }

    // B. Check exact match in database using normalized_query index (O(1) lookup)
    try {
        const normalized = queryText.trim().toLowerCase();
        const dbExact = await query(`
            SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals
            FROM search_cache
            WHERE normalized_query = $1
              AND length(answer) >= 200
              AND answer NOT LIKE '%AI assistant is currently unavailable%'
            LIMIT 1
        `, [normalized]);

        if (dbExact.rows.length > 0) {
            const cached = dbExact.rows[0];
            const resPayload = {
                reasoning: 'Retrieved from exact search cache.',
                answer: cached.answer,
                contextUsed: typeof cached.contextUsed === 'string' ? JSON.parse(cached.contextUsed) : cached.contextUsed,
                visuals: typeof cached.visuals === 'string' ? JSON.parse(cached.visuals) : cached.visuals
            };
            logger.info(`Database exact match HIT for query: "${queryText}"`);
            await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
            return { ...resPayload, cached: true };
        }
    } catch (dbError) {
        logger.error('Exact DB cache search failed:', dbError);
    }

    // C. Check semantic vector cache (requires 1 embedding call)
    const cachedResult = await SemanticCacheService.findSimilar(queryText);
    if (cachedResult) {
        const resPayload = {
            reasoning: 'Retrieved from semantic cache.',
            answer: cachedResult.answer,
            contextUsed: cachedResult.contextUsed,
            visuals: cachedResult.visuals
        };
        await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
        return { ...resPayload, cached: true };
    }

    return null;
}

export async function checkExactCachesOnly(
    queryText: string,
    redisKey: string
): Promise<(ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }) | null> {
    const cachedResponse = await cacheGet(redisKey);
    if (cachedResponse) {
        try {
            const parsed = JSON.parse(cachedResponse);
            if (parsed.answer && typeof parsed.answer === 'string' && parsed.answer.length >= 200 && !parsed.answer.includes('AI assistant is currently unavailable')) {
                logger.info(`Redis exact match HIT (fresh) for query: "${queryText}"`);
                return { ...parsed, cached: true };
            } else {
                logger.warn(`Evicting short or poisoned Redis cache entry for query: "${queryText}"`);
                await cacheDelete(redisKey);
            }
        } catch (e) { logger.error('Failed to parse cached Redis response:', e); }
    }
    try {
        const normalized = queryText.trim().toLowerCase();
        const dbExact = await query(`
            SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals
            FROM search_cache
            WHERE normalized_query = $1
              AND length(answer) >= 200
              AND answer NOT LIKE '%AI assistant is currently unavailable%'
            LIMIT 1
        `, [normalized]);
        if (dbExact.rows.length > 0) {
            const cached = dbExact.rows[0];
            const resPayload = {
                reasoning: 'Retrieved from exact search cache.',
                answer: cached.answer,
                contextUsed: typeof cached.contextUsed === 'string' ? JSON.parse(cached.contextUsed) : cached.contextUsed,
                visuals: typeof cached.visuals === 'string' ? JSON.parse(cached.visuals) : cached.visuals
            };
            logger.info(`Database exact match HIT (fresh) for query: "${queryText}"`);
            await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
            return { ...resPayload, cached: true };
        }
    } catch (dbError) { logger.error('Exact DB cache search failed:', dbError); }
    return null;
}

/** Cache lookup honoring real-time bypass: realtime intents only trust exact/fresh caches and skip the semantic cache. */
export async function checkAnswerCaches(
    queryText: string,
    redisKey: string,
    attachments: KnowledgeAttachment[] | undefined,
    isRealTimeIntent: boolean
): Promise<(ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }) | null> {
    if (attachments && attachments.length > 0) return null;
    // Bypass semantic cache for real-time intents (market/weather) to avoid stale 24h answers
    const hit = isRealTimeIntent ? await checkExactCachesOnly(queryText, redisKey) : await checkCaches(queryText, redisKey);
    return hit ?? null;
}
