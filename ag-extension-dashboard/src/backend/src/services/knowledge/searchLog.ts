import { cacheGet, cacheSet } from '@/services/cacheService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import type { SearchHistoryEntry, SearchStats } from '@/services/knowledge/types';

const STATS_CACHE_KEY = 'knowledge:search:stats';
const STATS_CACHE_TTL = 300; // 5 minutes

/**
 * Search analytics + history persistence for the knowledge pipeline.
 */

/** Log a new search query for analytics and history. */
export async function logSearch(
    userId: string,
    queryText: string,
    category?: string,
    crop?: string,
    answer?: string,
    reasoning?: string,
    visuals?: unknown
): Promise<void> {
    try {
        await query(`
            INSERT INTO knowledge_searches (user_id, query, category, crop, answer, reasoning, visuals, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [userId, queryText, category, crop, answer, reasoning, visuals ? JSON.stringify(visuals) : null]);
    } catch (error) {
        logger.error('Failed to log knowledge search:', error);
    }
}

/** Get recent search history for a user (de-duplicated). */
export async function getSearchHistory(userId: string, limit: number = 10): Promise<SearchHistoryEntry[]> {
    try {
        // Using a subquery with ROW_NUMBER to only return the latest instance of each unique query
        const result = await query<SearchHistoryEntry>(`
            SELECT id, query as "queryText", answer, reasoning, visuals, category, crop, created_at as "createdAt"
            FROM (
                SELECT id, query, answer, reasoning, visuals, category, crop, created_at,
                       ROW_NUMBER() OVER (PARTITION BY query ORDER BY created_at DESC) as rn
                FROM knowledge_searches
                WHERE user_id = $1
            ) sub
            WHERE sub.rn = 1
            ORDER BY sub.created_at DESC
            LIMIT $2
        `, [userId, limit]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get search history:', error);
        return [];
    }
}

/**
 * Get knowledge search statistics for visuals.
 * Cached in Redis for 5 minutes to avoid repeated expensive queries.
 */
export async function getSearchStats(): Promise<SearchStats> {
    try {
        // Check Redis cache first
        const cachedStats = await cacheGet(STATS_CACHE_KEY);
        if (cachedStats) {
            logger.debug('Search stats cache HIT');
            return JSON.parse(cachedStats) as SearchStats;
        }

        logger.debug('Search stats cache MISS — querying database');
        const [topCrops, topCategories, totalQueriesResult, cachedResult, articleResult] = await Promise.all([
            query<{ crop: string | null; count: string | number }>(`SELECT crop, COUNT(*) as count FROM knowledge_searches WHERE crop IS NOT NULL GROUP BY crop ORDER BY count DESC LIMIT 5`),
            query<{ category: string | null; count: string | number }>(`SELECT category, COUNT(*) as count FROM knowledge_searches WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5`),
            query<{ count: string | number }>(`SELECT COUNT(*) as count FROM knowledge_searches`),
            query<{ count: string | number }>(`SELECT COUNT(*) as count FROM search_cache`),
            query<{ total: string | number; embedded: string | number }>(`SELECT COUNT(*)::int AS total, COUNT(embedding)::int AS embedded FROM knowledge_articles`),
        ]);

        const stats = {
            crops: topCrops.rows,
            categories: topCategories.rows,
            totalQueries: Number(totalQueriesResult.rows[0]?.count || 0),
            cachedQueries: Number(cachedResult.rows[0]?.count || 0),
            totalArticles: Number(articleResult.rows[0]?.total || 0),
            embeddedArticles: Number(articleResult.rows[0]?.embedded || 0),
        };

        // Cache in Redis with 5-minute TTL (non-blocking)
        cacheSet(STATS_CACHE_KEY, JSON.stringify(stats), STATS_CACHE_TTL)
            .catch(e => logger.error('Failed to cache search stats:', e));

        return stats;
    } catch (error) {
        logger.error('Failed to get search stats:', error);
        return { crops: [], categories: [], totalQueries: 0, cachedQueries: 0 };
    }
}
