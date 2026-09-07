import type { SearchResult } from '@/services/vectorService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { cacheGet, cacheSet, cacheDelete } from '@/services/cacheService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import type { AnswerVisuals, CachedAnswer, FinalAnswer, KnowledgeAttachment } from '@/services/knowledge/types';

/**
 * Layered answer-cache lookups: Redis exact match → Postgres exact match →
 * semantic vector cache. Real-time intents skip the semantic layer.
 */

interface ExactCacheRow {
    queryText: string;
    answer: string;
    contextUsed: unknown;
    visuals: unknown;
}

function isCacheablePayload(parsed: unknown): parsed is Record<string, unknown> & { answer: string } {
    return (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as { answer?: unknown }).answer === 'string'
    );
}

function isUsableAnswer(parsed: { answer: string }): boolean {
    return parsed.answer.length >= 200 && !parsed.answer.includes('AI assistant is currently unavailable');
}

function parseStoredJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return value;
    }
}

function toCachedAnswer(row: ExactCacheRow, reasoning: string): CachedAnswer {
    return {
        reasoning,
        answer: row.answer,
        contextUsed: parseStoredJson(row.contextUsed) as SearchResult[],
        visuals: parseStoredJson(row.visuals) as AnswerVisuals | undefined,
    };
}

async function lookupDbExact(queryText: string): Promise<ExactCacheRow | null> {
    try {
        const normalized = queryText.trim().toLowerCase();
        const dbExact = await query<ExactCacheRow>(`
            SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals
            FROM search_cache
            WHERE normalized_query = $1
              AND length(answer) >= 200
              AND answer NOT LIKE '%AI assistant is currently unavailable%'
            LIMIT 1
        `, [normalized]);
        return dbExact.rows.length > 0 ? dbExact.rows[0] : null;
    } catch (dbError) {
        logger.error('Exact DB cache search failed:', dbError);
        return null;
    }
}

export async function checkCaches(
    queryText: string,
    redisKey: string
): Promise<FinalAnswer | null> {
    // A. Check Redis
    const cachedResponse = await cacheGet(redisKey);
    if (cachedResponse) {
        try {
            const parsed: unknown = JSON.parse(cachedResponse);
            if (isCacheablePayload(parsed) && isUsableAnswer(parsed)) {
                logger.info(`Redis exact match HIT for query: "${queryText}"`);
                return { ...(parsed as unknown as CachedAnswer), cached: true };
            } else {
                logger.warn(`Evicting short or poisoned Redis cache entry for query: "${queryText}"`);
                await cacheDelete(redisKey);
            }
        } catch (e) {
            logger.error('Failed to parse cached Redis response:', e);
        }
    }

    // B. Check exact match in database using normalized_query index (O(1) lookup)
    const dbExact = await lookupDbExact(queryText);
    if (dbExact) {
        const resPayload = toCachedAnswer(dbExact, 'Retrieved from exact search cache.');
        logger.info(`Database exact match HIT for query: "${queryText}"`);
        await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
        return { ...resPayload, cached: true };
    }

    // C. Check semantic vector cache (requires 1 embedding call)
    const cachedResult = await SemanticCacheService.findSimilar(queryText);
    if (cachedResult) {
        const resPayload: CachedAnswer = {
            reasoning: 'Retrieved from semantic cache.',
            answer: cachedResult.answer,
            contextUsed: cachedResult.contextUsed as SearchResult[],
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
): Promise<FinalAnswer | null> {
    const cachedResponse = await cacheGet(redisKey);
    if (cachedResponse) {
        try {
            const parsed: unknown = JSON.parse(cachedResponse);
            if (isCacheablePayload(parsed) && isUsableAnswer(parsed)) {
                logger.info(`Redis exact match HIT (fresh) for query: "${queryText}"`);
                return { ...(parsed as unknown as CachedAnswer), cached: true };
            } else {
                logger.warn(`Evicting short or poisoned Redis cache entry for query: "${queryText}"`);
                await cacheDelete(redisKey);
            }
        } catch (e) { logger.error('Failed to parse cached Redis response:', e); }
    }
    const dbExact = await lookupDbExact(queryText);
    if (dbExact) {
        const resPayload = toCachedAnswer(dbExact, 'Retrieved from exact search cache.');
        logger.info(`Database exact match HIT (fresh) for query: "${queryText}"`);
        await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
        return { ...resPayload, cached: true };
    }
    return null;
}

/** Cache lookup honoring real-time bypass: realtime intents only trust exact/fresh caches and skip the semantic cache. */
export async function checkAnswerCaches(
    queryText: string,
    redisKey: string,
    attachments: KnowledgeAttachment[] | undefined,
    isRealTimeIntent: boolean
): Promise<FinalAnswer | null> {
    if (attachments && attachments.length > 0) return null;
    // Bypass semantic cache for real-time intents (market/weather) to avoid stale 24h answers
    const hit = isRealTimeIntent ? await checkExactCachesOnly(queryText, redisKey) : await checkCaches(queryText, redisKey);
    return hit ?? null;
}
