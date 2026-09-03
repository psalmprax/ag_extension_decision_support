import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { getPool, query } from '@/services/databaseService';
import type {
  CountRow,
  KnowledgeArticleRow,
} from '@/types/rowTypes';
import {
  mapCountRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { knowledgeSearchSchema } from '@/shared-api/knowledge';
import { tavilyService } from '@/services/tavilyService';
import { SearchResult } from '@/services/vectorService';
import type { Citation } from '@/services/ragV2Service';
import { getKnowledgeEvidenceStatus } from '@/services/knowledgeService';
import { safeError } from '@/utils/safeResponse';
import { usageService } from '@/services/usageService';

const router = Router();

async function performLegacySearch(limit: string, offset: string, category?: string, crop?: string): Promise<{ articles: SearchResult[]; totalCount: number }> {
    let sql = 'SELECT * FROM knowledge_articles WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM knowledge_articles WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (category) {
        sql += ' AND category = $' + paramIndex;
        countSql += ' AND category = $' + paramIndex;
        params.push(category);
        paramIndex++;
    }

    if (crop) {
        sql += ' AND $' + paramIndex + ' = ANY(crops)';
        countSql += ' AND $' + paramIndex + ' = ANY(crops)';
        params.push(crop);
        paramIndex++;
    }

    sql += ' ORDER BY "order" ASC, created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
    const countResult = await query<CountRow>(countSql, params);
    const totalCount = mapCountRow(countResult.rows[0]).count;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query<KnowledgeArticleRow>(sql, params);
    return {
        articles: result.rows as unknown as SearchResult[],
        totalCount,
    };
}

async function executeRagV2Search(q: string, limit: string, category: string | undefined, crop: string | undefined, cacheKey: string, res: Response) {
    try {
        const { RAGV2Service } = await import('@/services/ragV2Service');
        const enhanced = await RAGV2Service.enhancedSearch(q, {
            limit: parseInt(limit, 10),
            useChunks: true,
            useGraph: true,
            useReranking: true,
            filters: { category, crop }
        });
        const articles = enhanced.results.map(r => ({
            id: r.articleId,
            content: r.content,
            metadata: r.metadata,
            score: r.rerankScore ?? r.score,
            citation: r.citation
        }));
        const response = {
            success: true,
            data: { articles, graphContext: enhanced.graphContext, citations: enhanced.citations },
        };
        await cacheSet(cacheKey, JSON.stringify(response), 300);
        return res.json(response);
    } catch (ragErr) {
        logger.warn('RAG v2 search failed, falling back to standard search:', ragErr);
        return null;
    }
}

async function fetchKnowledgeArticles(q: unknown, limit: unknown, offset: unknown, category: unknown, crop: unknown, v2: unknown, cacheKey: string, res: Response): Promise<SearchResult[] | Response> {
    let articles: SearchResult[] = [];
    const pool = getPool();

    if (pool && q) {
        if (v2 === 'true') {
            const ragRes = await executeRagV2Search(q as string, limit as string, category as string | undefined, crop as string | undefined, cacheKey, res);
            if (ragRes) return ragRes; // Response already sent
        }
        articles = await KnowledgeService.searchKnowledge(q as string, parseInt(limit as string, 10), {
            category: category as string | undefined,
            crop: crop as string | undefined
        });
    } else if (pool) {
        const legacy = await performLegacySearch(limit as string, offset as string, category as string | undefined, crop as string | undefined);
        articles = legacy.articles;
        (articles as unknown as { totalCount: number }).totalCount = legacy.totalCount;
    }

    if (!articles || articles.length === 0) {
        articles = [];
    }
    return articles;
}

// Search knowledge base
// Query contract = shared `knowledgeSearchSchema` (uses `query`), with the legacy `q` alias.
// Both `query` (canonical) and `q` (legacy) are optional: no term = browse/list mode.
const knowledgeSearchQuery = knowledgeSearchSchema
  .extend({ q: z.string().max(500).optional(), v2: z.union([z.boolean(), z.string()]).optional() });

router.get('/search', validate({ query: knowledgeSearchQuery }), async (req: Request, res: Response) => {
    try {
        const qv = req.query as unknown as z.infer<typeof knowledgeSearchQuery>;
        const q = qv.query ?? qv.q;
        const category = qv.category;
        const crop = qv.crop;
        const limit = String(qv.limit ?? 10);
        const offset = String(qv.offset ?? 0);
        const v2 = qv.v2;

        const cacheKey = 'knowledge:search:' + q + ':' + category + ':' + crop + ':' + limit + ':' + offset + ':' + (v2 || 'false');
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const fetchResult = await fetchKnowledgeArticles(q, limit, offset, category, crop, v2, cacheKey, res);
        if ('json' in fetchResult && typeof fetchResult.json === 'function') {
            // It's a response object, already handled
            return;
        }

        const articles = fetchResult as SearchResult[];
        const total = (articles as unknown as { totalCount?: number }).totalCount ?? articles.length;
        const response = {
            success: true,
            data: {
                articles,
                total,
                limit: parseInt(limit as string, 10),
                offset: parseInt(offset as string, 10),
            },
        };

        await cacheSet(cacheKey, JSON.stringify(response), 300);

        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string | undefined;
        if (userId && q) {
            KnowledgeService.logSearch(userId, q as string, category as string | undefined, crop as string | undefined).catch(err => {
                logger.warn('Knowledge logSearch fire-and-forget failed:', err);
            });
        }

        res.json(response);
    } catch (error) {
        logger.error('Knowledge search error:', error);
        safeError(res, 500, 'Search failed');
    }
});

// Search external agricultural data via Tavily
router.get('/search/external', async (req: Request, res: Response) => {
    try {
        const { q, limit = '5' } = req.query;
        if (!q) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }
        if (!tavilyService.isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Web search not configured',
                message: 'Add TAVILY_API_KEY to enable external agricultural data search'
            });
        }
        const results = await tavilyService.search(q as string, parseInt(limit as string, 10));
        if (!results) {
            return safeError(res, 500, 'Search failed');
        }
        res.json({
            success: true,
            data: {
                query: q,
                answer: results.answer,
                results: results.results,
                source: 'tavily',
            },
        });
    } catch (error) {
        logger.error('External search error:', error);
        safeError(res, 500, 'Failed to search external sources');
    }
});

async function loadWeatherAndFao(context: Record<string, unknown>, location: string, region: string, crop?: string) {
    const { WeatherService } = await import('@/services/weatherService');
    const { FAOService } = await import('@/services/faoService');
    const tasks: Array<Promise<void>> = [];

    tasks.push((async () => {
        try {
            context.weather = await WeatherService.getByLocation(location);
            (context.sources as string[]).push('weather_forecast');
        } catch (error) {
            context.weatherError = (error as Error).message;
        }
    })());

    tasks.push((async () => {
        try {
            context.diseaseAlerts = await FAOService.getDiseaseAlerts(region, crop);
            (context.sources as string[]).push('fao_disease_alerts');
        } catch (error) {
            context.diseaseAlertsError = (error as Error).message;
        }
    })());

    return tasks;
}

async function loadGeoData(context: Record<string, unknown>, lat: string, lng: string) {
    const tasks: Array<Promise<void>> = [];
    tasks.push((async () => {
        try {
            const { NasaPowerService } = await import('@/services/data/nasaPowerService');
            const nasa = new NasaPowerService();
            context.agroclimate = await nasa.getAgroclimateSummary(parseFloat(lat), parseFloat(lng), 7);
            (context.sources as string[]).push('nasa_power');
        } catch (error) {
            context.agroclimateError = (error as Error).message;
        }
    })());

    tasks.push((async () => {
        try {
            const { soilGridsService } = await import('@/services/data/soilGridsService');
            context.soilProperties = await soilGridsService.fetchSoilProperties(parseFloat(lat), parseFloat(lng));
            (context.sources as string[]).push('soilgrids_isric');
        } catch (error) {
            context.soilPropertiesError = (error as Error).message;
        }
    })());
    return tasks;
}

// Live context endpoint
router.get('/live-context', async (req: Request, res: Response) => {
    try {
        const { location = 'Kenya', region = 'Kenya', crop, lat, lng, includeMarket = 'true' } = req.query;
        const context: Record<string, unknown> = {
            location,
            region,
            crop,
            generatedAt: new Date().toISOString(),
            sources: []
        };

        const tasks: Array<Promise<void>> = await loadWeatherAndFao(context, location as string, region as string, crop as string | undefined);

        if (lat && lng) {
            const geoTasks = await loadGeoData(context, lat as string, lng as string);
            tasks.push(...geoTasks);
        }

        if (includeMarket === 'true') {
            const { marketPriceService } = await import('@/services/marketPriceService');
            tasks.push((async () => {
                try {
                    context.marketPrices = await marketPriceService.getLatestPrices();
                    (context.sources as string[]).push('market_prices');
                } catch (error) {
                    context.marketPricesError = (error as Error).message;
                }
            })());
        }

        await Promise.all(tasks);
        res.json({ success: true, data: context });
    } catch (error) {
        logger.error('Live context error:', error);
        safeError(res, 500, 'Failed to load live agricultural context');
    }
});

// Ask AI a question (RAG-based)
router.post('/ask', async (req: Request, res: Response) => {
    try {
        const { question } = req.body;
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string;
        const userRole = (user?.role) as string | undefined;

        if (!question) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }
        if (!userId) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }

        // Daily knowledge quota check (3 per day for Free tier; admin is completely exempt)
        const dailyQuota = userRole === 'admin'
            ? { allowed: true, current: 0, limit: -1, remaining: 999999 }
            : await usageService.checkDailyKnowledgeLimit(userId, userRole);

        if (!dailyQuota.allowed) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                error: 'Daily free knowledge base limit reached (3/3 queries). Please upgrade to Pro for unlimited queries.',
                data: {
                    dailyRemaining: 0,
                    limit: dailyQuota.limit,
                    upgradeRequired: true,
                }
            });
        }

        // Free-tier users (farmers) route to the freebuff best-effort provider;
        // officers and admins continue to use the primary/fallback chain.
        const askUser = user as Record<string, unknown> | undefined;
        const isFreeTier = askUser?.role === 'farmer';
        const preferredProvider = isFreeTier ? 'freebuff' : undefined;
        const result = await KnowledgeService.askQuestion(userId, question, undefined, { preferredProvider });

        // Record search for daily quota tracking
        await usageService.recordKnowledgeSearch(userId, question, result.answer);

        let citations: Citation[] = [];
        try {
            const { RAGV2Service } = await import('@/services/ragV2Service');
            const enhanced = await RAGV2Service.enhancedSearch(question, {
                limit: 3,
                useChunks: true,
                useGraph: false,
                useReranking: false
            });
            citations = enhanced.citations;
        } catch (ragErr) {
            // Non-fatal for the answer, but never silent: an empty citation list is
            // otherwise indistinguishable from "retrieval found nothing".
            logger.warn('RAG v2 citation retrieval failed for /knowledge/ask; evidenceStatus will reflect zero citations:', ragErr);
        }

        const remainingAfter = userRole === 'admin' ? 999999 : Math.max(0, dailyQuota.remaining - 1);
        const maxScore = citations.length ? Math.max(...citations.map(c => typeof c.score === 'number' ? c.score : 0)) : 0;
        const evidenceStatus = getKnowledgeEvidenceStatus(citations.length, result.contextUsed.length, maxScore);

        res.json({
            success: true,
            data: {
                answer: result.answer,
                reasoning: result.reasoning,
                visuals: result.visuals,
                audio: (result as unknown as Record<string, unknown>).audio,
                contextUsed: result.contextUsed,
                cached: result.cached,
                citations,
                evidenceStatus,
                dailyRemaining: remainingAfter,
                dailyLimit: dailyQuota.limit,
            },
        });
    } catch (error) {
        logger.error('Ask question error:', error);
        if (!res.headersSent) {
            safeError(res, 500, 'Failed to get answer');
        }
    }
});

// Knowledge graph entity lookup
router.get('/graph/:entity', async (req: Request, res: Response) => {
    try {
        const { RAGV2Service } = await import('@/services/ragV2Service');
        const related = await RAGV2Service.getRelatedEntities(req.params.entity);
        res.json({ success: true, data: related });
    } catch (error) {
        logger.error('Graph query error:', error);
        safeError(res, 500, 'Failed to query knowledge graph');
    }
});

export default router;
