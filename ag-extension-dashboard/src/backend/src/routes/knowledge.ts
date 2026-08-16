import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { getPool, query } from '@/services/databaseService';
import type {
  CountRow,
  KnowledgeArticleRow,
  KnowledgeCategoryRow,
  KnowledgeCropRow,
  KnowledgeArticleForVector,
} from '@/types/rowTypes';
import {
  mapCountRow,
  mapKnowledgeArticleRow,
  mapKnowledgeCategoryRows,
  mapKnowledgeCropRows,
} from '@/types/dtos';
import { getPrisma } from '@/services/prismaService';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { tavilyService } from '@/services/tavilyService';
import { VectorService, SearchResult } from '@/services/vectorService';
import type { Citation } from '@/services/ragV2Service';
import { safeError } from '@/utils/safeResponse';
import { parseSynthesizeVisitResponse } from '@/schemas/synthesizeVisitResponse';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { usageService } from '@/services/usageService';

const router = Router();
const knowledgeAdminRoles: UserRole[] = ['admin', 'regional_manager', 'extension_officer'];

// Check daily knowledge query quota (3 per day for Free tier)
router.get('/quota', async (req: Request, res: Response) => {
    try {
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const quota = await usageService.checkDailyKnowledgeLimit(userId);
        const isFree = await usageService.isFreeUser(userId);
        return res.json({
            success: true,
            data: {
                ...quota,
                isFree,
            }
        });
    } catch (error) {
        logger.error('Failed to get knowledge quota:', error);
        safeError(res, 500, 'Failed to fetch knowledge quota');
    }
});

async function upsertVector(article: KnowledgeArticleForVector): Promise<void> {
    await VectorService.upsertDocument(article.id, article.content, {
        title: article.title,
        category: article.category,
        tags: article.tags,
        crops: article.crops,
        regions: article.regions,
        source: article.source,
        sourceUrl: article.sourceUrl,
        contentType: article.contentType
    });
}

// Apply authentication to all knowledge routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

function sanitizeKnowledgeContent(content: string, contentType: string): string {
    if (contentType !== 'html') return content;
    return content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

const errorStatusMap: Record<string, number> = {
    'ARTICLE_NOT_FOUND': 404,
    'SEARCH_FAILED': 500,
    'USER_NOT_AUTHENTICATED': 401,
    'REORDER_FAILED': 400
};

// Mock knowledge articles for vector store seeding
export const mockKnowledgeArticles = [
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb01',
        title: 'Maize Disease Management',
        content: 'Common maize diseases include Northern leaf blight, Southern rust, and Grey leaf spot. Prevention strategies include crop rotation, using resistant varieties, and proper plant spacing. For Northern leaf blight, apply fungicides at the first sign of symptoms.',
        category: 'Crop Management',
        tags: ['maize', 'diseases', 'prevention'],
        crop: 'maize',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb02',
        title: 'Soil Fertility Management',
        content: 'Regular soil testing helps determine nutrient requirements. Organic matter addition through compost or manure improves soil structure and water retention. Apply nitrogen in split doses for optimal uptake.',
        category: 'Soil Health',
        tags: ['soil', 'fertility', 'organic'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb03',
        title: 'Climate-Smart Agriculture',
        content: 'Climate-smart agriculture practices include conservation agriculture, agroforestry, and water harvesting techniques. These methods help adapt to changing weather patterns while reducing greenhouse gas emissions.',
        category: 'Climate',
        tags: ['climate', 'weather', 'adaptation'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb04',
        title: 'Pest Control in Vegetables',
        content: 'Integrated Pest Management (IPM) combines biological, cultural, and chemical methods. Common vegetable pests include aphids, whiteflies, and fruit borers. Use neem oil for organic control.',
        category: 'Pest Management',
        tags: ['pests', 'vegetables', 'IPM'],
        crop: 'vegetables',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb05',
        title: 'Post-Harvest Handling',
        content: 'Proper post-harvest practices include timely harvesting, appropriate storage conditions, and processing techniques. Store produce at cool temperatures when possible. Use proper packaging to prevent damage.',
        category: 'Post-Harvest',
        tags: ['harvest', 'storage', 'processing'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb06',
        title: 'Cassava Crop Management & Irrigation',
        content: 'Cassava (Manihot esculenta) is a staple tropical root crop. Soil Diagnostics: Grows best in deep, well-drained sandy loam or silt loam soils with a pH of 5.5 to 6.5. Highly sensitive to waterlogging. Irrigation Guidelines: Evapotranspiration demand is 3-4mm/day. Requires moderate but consistent watering (about 250mm to 350mm total) during the first 3 months (tuber initiation phase) for maximum starch build-up. Once established, cassava is extremely drought-tolerant and can survive 4-6 months with minimal moisture, although yields will be reduced. Drip irrigation emitters should be placed 30cm from the stem base, delivering 2 liters/hour in 1-hour cycles twice per week during dry spells.',
        category: 'Crop Management',
        tags: ['cassava', 'irrigation', 'soil', 'tropics'],
        crop: 'cassava',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb07',
        title: 'Yam Cultivation & Staking',
        content: 'Yam (Dioscorea spp.) cultivation requires rich, loose, deep soils (such as clay loam or alluvial silt loam) with a high concentration of organic compost and a pH range of 5.5 to 6.5. Yam tubers require active staking (height 2-3 meters) to maximize sunlight interception. Water Requirements: Yams are water-intensive, requiring 1200mm to 1500mm of water distributed evenly over their 7-8 month growing cycle. Starch accumulation occurs during the bulking stage (4-6 months after planting), where a moisture deficit can drop yields by up to 60%. Drip irrigation must maintain soil moisture above 60% field capacity.',
        category: 'Soil & Water',
        tags: ['yam', 'staking', 'organic', 'tropics'],
        crop: 'yam',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb08',
        title: 'Cocoa Tree Agronomy & Shade Control',
        content: 'Cocoa (Theobroma cacao) is a delicate tropical tree requiring highly structured clay-loam soils with a pH of 5.0 to 7.5 and a minimum soil depth of 1.5 meters. Soil Diagnostics: High levels of calcium, potassium, and magnesium are critical. Evapotranspiration is 4-5mm/day. Irrigation: Cocoa requires 1500mm to 2000mm of rain or micro-sprinkler irrigation annually. Avoid heavy sprinkler watering on leaves to prevent Black Pod Disease (Phytophthora megakarya). Shade management: Cocoa seedlings need 50% shade cover, reducing to 30% for mature trees. Pruning should be completed at the start of the dry season to improve ventilation and reduce pest habitats.',
        category: 'Pest & Crop Management',
        tags: ['cocoa', 'shade', 'black pod', 'tropics'],
        crop: 'cocoa',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb09',
        title: 'Coffee Agronomy (Arabica vs Robusta)',
        content: 'Coffee (Coffea arabica & Coffea canephora/robusta) grows best in deep, acidic volcanic soils (Ferralsols, Nitisols) with a pH of 5.0 to 6.0. Arabica prefers higher altitudes (1000-2000m) and cooler climates, whereas Robusta thrives in warmer, lower elevation zones. Nutrition Diagnostics: High nitrogen (N) and potassium (K) are required. Apply NPK 15-15-15 in split applications during the rainy seasons. Irrigation: Drip irrigation delivering 15-20 liters per tree weekly during dry flowering periods stabilizes berry size and prevents fruit drop. Maintain strict pruning rules (single-stem vs multi-stem systems) to optimize yields.',
        category: 'Crop Management',
        tags: ['coffee', 'arabica', 'robusta', 'pruning', 'fertilizer'],
        crop: 'coffee',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb10',
        title: 'Rice Cultivation and Water Submergence Systems',
        content: 'Rice (Oryza sativa) requires heavy, poorly drained clay or clay-loam soils to retain a standing water layer (flooding depth of 5cm to 10cm). Soil pH should ideally range from 6.0 to 7.0. Water Management: Traditional lowland rice requires continuous submergence from transplanting until 2 weeks before harvest. Alternate Wetting and Drying (AWD) is an advanced water-saving irrigation method where the field is allowed to dry until the water table drops to 15cm below the soil surface before re-flooding, reducing water consumption by up to 30% without yield loss.',
        category: 'Water Management',
        tags: ['rice', 'awd', 'flooding', 'water conservation'],
        crop: 'rice',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb11',
        title: 'Plantain & Banana Nutrient Management',
        content: 'Plantain and Banana (Musa spp.) require fertile, deep, well-aerated soils (volcanic or alluvial loams) with high organic matter, excellent drainage, and a pH between 5.5 and 7.0. Water requirements are extremely high (100-150mm per month). Moisture stress triggers immediate leaf yellowing, reduced bunch weight, and long fruit-filling times. Fertilization: Heavy potassium feeding is vital for bunch formation. Apply nitrogen (urea) and potassium (muriate of potash) monthly. Drip irrigation systems should use dual lateral lines on either side of the plant row to cover the dense feeder root zone.',
        category: 'Soil & Water',
        tags: ['plantain', 'banana', 'potassium', 'fertilizer'],
        crop: 'plantain',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb12',
        title: 'Sandy Loam Soil Diagnostics & Aeration',
        content: 'Sandy Loam soil consists of 60% sand, 20% silt, and 20% clay. Diagnostics: Excellent aeration and drainage but extremely low nutrient holding capacity (Cation Exchange Capacity of 5-15 meq/100g) and low water retention. Water management: Requires frequent, low-volume irrigation (micro-drip cycles of 20-30 minutes daily) to prevent nutrient leaching. Soil improvement: Incorporate green manures, cover crops, and mature organic compost (at least 10 tons per hectare annually) to increase soil carbon and water retention.',
        category: 'Soil Health',
        tags: ['soil', 'sandy loam', 'compost', 'aeration'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb13',
        title: 'Clay Loam Soil Management & Drainage',
        content: 'Clay Loam soil consists of 30-40% clay, 20-40% sand, and 20-40% silt. Diagnostics: High nutrient retention capacity (CEC of 20-30 meq/100g) but prone to compaction, slow drainage, and waterlogging. Management: Perform subsoiling or deep ripping to break up hardpans. Add gypsum (calcium sulfate) at 2-5 tons/hectare to improve structure and promote flocculation of clay particles. Irrigation: Sprinkler or drip systems must use low application rates (less than 10mm/hour) to prevent runoff and ponding.',
        category: 'Soil Health',
        tags: ['soil', 'clay loam', 'drainage', 'compaction'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb14',
        title: 'Acidic Volcanic Soils (Ferralsols & Acrisols)',
        content: 'Acidic volcanic soils, common in high-altitude tropical zones, suffer from intense leaching and phosphorus (P) fixation (phosphorus binds tightly to iron and aluminum oxides, making it unavailable to plants). Diagnostics: pH levels are often below 5.0. Lime requirements: Apply agricultural lime (calcium carbonate) or dolomite to raise pH above 5.5, which unlocks bound phosphorus. Fertilizer guidelines: Apply rock phosphate or triple superphosphate (TSP) in banded rows directly next to plant roots to minimize soil contact and fixation.',
        category: 'Soil Health',
        tags: ['soil', 'acidic', 'lime', 'volcanic', 'phosphorus'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb15',
        title: 'Precision Irrigation Calculations',
        content: 'Effective crop irrigation requires calculating the daily water requirement using the equation: ETc = ETo x Kc. ETc is the crop evapotranspiration, ETo is the reference evapotranspiration (based on local temperature, solar radiation, wind, and humidity), and Kc is the crop coefficient (which varies by growth stage). For example, Maize has a Kc of 0.4 at emergence, rising to 1.15 during tasseling/silking, and dropping to 0.5 at maturity. During tasseling in a dry region with an ETo of 5mm/day, the crop requires: 5 x 1.15 = 5.75mm of water daily.',
        category: 'Water Management',
        tags: ['irrigation', 'math', 'evapotranspiration', 'kc'],
        crop: 'all',
    },
];

// Seed knowledge articles into database
export async function seedKnowledgeArticles(): Promise<void> {
    const pool = getPool();
    if (!pool) return;

    const articles = mockKnowledgeArticles.map(art => ({
        id: art.id,
        title: art.title,
        content: art.content,
        category: art.category,
        tags: art.tags,
        crops: [art.crop],
        regions: art.crop === 'maize' ? ['East Africa'] : ['tropical'],
        source: 'AG Extension Tropical Agronomy Seed'
    }));

    try {
        logger.info(`Upserting ${articles.length} standard seed articles to database`);
        await query(`
            DELETE FROM knowledge_articles
            WHERE id <> ALL($1::uuid[])
              AND title = ANY($2::text[])
              AND source IS NULL
              AND embedding IS NULL
        `, [articles.map(article => article.id), articles.map(article => article.title)]);

        for (const article of articles) {
            await query(`
                INSERT INTO knowledge_articles (id, title, content, category, tags, crops, regions, source, content_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'text')
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    category = EXCLUDED.category,
                    tags = EXCLUDED.tags,
                    crops = EXCLUDED.crops,
                    regions = EXCLUDED.regions,
                    source = EXCLUDED.source,
                    content_type = EXCLUDED.content_type,
                    updated_at = NOW()
            `, [article.id, article.title, article.content, article.category, article.tags, article.crops, article.regions, article.source]);
        }
        logger.info('Knowledge articles upserted successfully');
    } catch (error) {
        logger.error('Error seeding knowledge articles:', error);
    }
}

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
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q, category, crop, limit = '10', offset = '0', v2 } = req.query;

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
        const userId = user?.userId || user?.id;
        if (userId && q) {
            KnowledgeService.logSearch(userId, q as string, category as string | undefined, crop as string | undefined).catch(() => {});
        }

        res.json(response);
    } catch (error) {
        logger.error('Knowledge search error:', error);
        safeError(res, 500, 'Search failed');
    }
});

// Get recent search history
router.get('/history', async (req: Request, res: Response) => {
    try {
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = user?.userId || user?.id;
        if (!userId) {
            return res.status(errorStatusMap['USER_NOT_AUTHENTICATED']).json({
                success: false,
                errorCode: 'USER_NOT_AUTHENTICATED',
                error: 'User not authenticated'
            });
        }
        const history = await KnowledgeService.getSearchHistory(userId);
        res.json({ success: true, data: history });
    } catch (error) {
        logger.error('Get search history error:', error);
        safeError(res, 500, 'Failed to get search history');
    }
});

// Get search statistics
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const stats = await KnowledgeService.getSearchStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Get search stats error:', error);
        safeError(res, 500, 'Failed to get search statistics');
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

// Get all categories
router.get('/meta/categories', async (_req: Request, res: Response) => {
    try {
        const pool = getPool();
        let categories: string[] = [];
        if (pool) {
            const result = await query<KnowledgeCategoryRow>('SELECT DISTINCT category FROM knowledge_articles ORDER BY category');
            categories = mapKnowledgeCategoryRows(result.rows).map(c => c.category);
        }
        if (categories.length === 0) {
            return res.json({ success: true, data: [] });
        }
        res.json({ success: true, data: categories });
    } catch (error) {
        logger.error('Get categories error:', error);
        res.json({ success: true, data: [] });
    }
});

// Get all crops
router.get('/meta/crops', async (_req: Request, res: Response) => {
    try {
        const pool = getPool();
        let crops: string[] = [];
        if (pool) {
            const result = await query<KnowledgeCropRow>("SELECT DISTINCT unnest(crops) as crop FROM knowledge_articles WHERE crops IS NOT NULL");
            crops = mapKnowledgeCropRows(result.rows).map(c => c.crop);
        }
        if (crops.length === 0) {
            return res.json({ success: true, data: [] });
        }
        res.json({ success: true, data: [...new Set(crops)] });
    } catch (error) {
        logger.error('Get crops error:', error);
        res.json({ success: true, data: [] });
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

// Get article by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();
        let article: KnowledgeArticleRow | null = null;
        if (pool) {
            const result = await query<KnowledgeArticleRow>('SELECT * FROM knowledge_articles WHERE id = $1', [id]);
            article = result.rows[0] ?? null;
        }
        if (!article) {
            return res.status(errorStatusMap['ARTICLE_NOT_FOUND']).json({
                success: false,
                errorCode: 'ARTICLE_NOT_FOUND',
                error: 'Article not found'
            });
        }
        res.json({ success: true, data: mapKnowledgeArticleRow(article) });
    } catch (error) {
        logger.error('Get article error:', error);
        safeError(res, 500, 'Failed to get article');
    }
});

// Synthesize a field visit from raw notes (returns summary, crop health, actions)
router.post('/synthesize-visit', async (req: Request, res: Response) => {
  try {
    const { farmerId, farmerName, crop, region, notes, visitType } = req.body as {
      farmerId?: string;
      farmerName?: string;
      crop?: string;
      region?: string;
      notes?: string;
      visitType?: string;
    };
    const user = (req as Request & { user?: Record<string, unknown> }).user;
    const userId = user?.userId || user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    if (!notes) {
      return res.status(400).json({ success: false, error: 'Visit notes are required' });
    }

    const prompt = `You are an agricultural extension officer. Synthesize the following field visit notes into a structured summary.

Farmer: ${farmerName ?? 'Unknown'}${farmerId ? ` (id: ${farmerId})` : ''}
Region: ${region ?? 'Unknown'}
Crop: ${crop ?? 'Unknown'}
Visit type: ${visitType ?? 'routine'}

Raw notes:
"""
${notes}
"""

Respond with valid JSON only (no markdown, no commentary). Schema:
{
  "summary": "2-3 sentence overview of the visit",
  "cropHealth": { "status": "good" | "fair" | "poor", "notes": "brief crop condition assessment" },
  "actions": [ { "priority": "high" | "medium" | "low", "description": "concrete next step" } ],
  "followUpDate": "ISO date string or null"
}`;

    // Free-tier users (farmers) route to the freebuff best-effort provider;
    // officers and admins continue to use the primary/fallback chain. The
    // freebuff provider is already wired into the fallback chain via
    // AIProviderFactory.getWithFallback, so the 'preferredProvider' hint is
    // forwarded through KnowledgeService.askQuestion options to nudge the
    // cascade toward the community proxy first when role === 'farmer'.
    const isFreeTier = (user as Record<string, unknown> | undefined)?.role === 'farmer';
    const preferredProvider = isFreeTier ? 'freebuff' : undefined;
    const result = await KnowledgeService.askQuestion(userId, prompt, undefined, { preferredProvider });

    const rawAnswer = (result.answer ?? '').trim();
    const summaryFallback = rawAnswer || 'Visit recorded.';
    const parsed = parseSynthesizeVisitResponse(rawAnswer, summaryFallback);

    res.json({
      success: true,
      data: {
        summary: parsed.summary,
        cropHealth: parsed.cropHealth,
        actions: parsed.actions,
        followUpDate: parsed.followUpDate,
        cached: result.cached ?? false,
      },
    });
  } catch (error) {
    logger.error('Synthesize visit error:', error);
    if (!res.headersSent) {
      safeError(res, 500, 'Failed to synthesize visit');
    }
  }
});

// Ask AI a question (RAG-based)
router.post('/ask', async (req: Request, res: Response) => {
    try {
        const { question } = req.body;
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string;

        if (!question) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }
        if (!userId) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }

        // Daily knowledge quota check (3 per day for Free tier)
        const dailyQuota = await usageService.checkDailyKnowledgeLimit(userId);
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
            // Non-fatal
        }

        const remainingAfter = Math.max(0, dailyQuota.remaining - 1);

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

// Share a knowledge article
import { createShareRoute } from './shareRouteFactory';
router.use(createShareRoute('knowledge'));

// Reorder knowledge articles
router.post('/reorder', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { items } = req.body;
        const prisma = getPrisma();

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required',
            });
        }

        for (const item of items) {
            if (!item.id || typeof item.order !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: 'Each item must have id and order',
                });
            }
        }

        const articleIds = items.map(item => item.id);
        const articles = await prisma.knowledgeArticle.findMany({
            where: { id: { in: articleIds } },
            select: { id: true }
        });

        if (articles.length !== items.length) {
            return res.status(400).json({
                success: false,
                error: 'Some articles not found',
            });
        }

        await prisma.$transaction(
            items.map(item =>
                prisma.knowledgeArticle.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        );

        res.json({ success: true, message: 'Articles reordered successfully' });
    } catch (error) {
        logger.error('Reorder articles error:', error);
        safeError(res, 500, 'Failed to reorder articles');
    }
});

// Create a new knowledge article
router.post('/', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const {
            title, content, contentType = 'text', summary, category,
            tags = [], crops = [], regions = [], source, sourceUrl
        } = req.body;
        const prisma = getPrisma();

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Title and content are required',
            });
        }

        if (!['text', 'html'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: 'contentType must be either "text" or "html"',
            });
        }

        const sanitizedContent = sanitizeKnowledgeContent(content, contentType);

        const article = await prisma.knowledgeArticle.create({
            data: {
                title,
                content: sanitizedContent,
                contentType,
                summary,
                category,
                tags,
                crops,
                regions,
                source,
                sourceUrl,
            },
        });

        await upsertVector(article);

        res.status(201).json({
            success: true,
            data: article,
        });
    } catch (error) {
        logger.error('Create article error:', error);
        safeError(res, 500, 'Failed to create article');
    }
});

async function processUpdateArticle(req: Request, res: Response) {
    const { id } = req.params;
    const {
        title, content, contentType, summary, category,
        tags, crops, regions, source, sourceUrl
    } = req.body;
    const prisma = getPrisma();

    const existingArticle = await prisma.knowledgeArticle.findUnique({
        where: { id }
    });

    if (!existingArticle) {
        return res.status(404).json({
            success: false,
            error: 'Article not found',
        });
    }

    if (contentType && !['text', 'html'].includes(contentType)) {
        return res.status(400).json({
            success: false,
            error: 'contentType must be either "text" or "html"',
        });
    }

    const sanitizedContent = content === undefined ? undefined : sanitizeKnowledgeContent(content, contentType || existingArticle.contentType || 'text');

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = sanitizedContent;
    if (contentType !== undefined) updateData.contentType = contentType;
    if (summary !== undefined) updateData.summary = summary;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (crops !== undefined) updateData.crops = crops;
    if (regions !== undefined) updateData.regions = regions;
    if (source !== undefined) updateData.source = source;
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
    updateData.updatedAt = new Date();

    const article = await prisma.knowledgeArticle.update({
        where: { id },
        data: updateData,
    });

    await upsertVector(article);

    return res.json({ success: true, data: article });
}

// Update a knowledge article
router.put('/:id', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        await processUpdateArticle(req, res);
    } catch (error) {
        logger.error('Update article error:', error);
        safeError(res, 500, 'Failed to update article');
    }
});

// Configure upload for knowledge ingestion
const knowledgeStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const knowledgeFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.md') || file.originalname.endsWith('.txt')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, TXT, and MD files are allowed.'));
    }
};

const knowledgeUpload = multer({
    storage: knowledgeStorage,
    fileFilter: knowledgeFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

async function extractContentFromFile(filePath: string, ext: string): Promise<string | null> {
    if (ext === '.pdf') {
        // @ts-expect-error pdf-parse has no TypeScript types
        const pdfParse = await import('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse.default(buffer);
        return pdfData.text;
    } else if (ext === '.txt' || ext === '.md') {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
}

async function processKnowledgeIngestion(req: Request, res: Response) {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { title, category = 'General', crops, regions, tags } = req.body;
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    const content = await extractContentFromFile(filePath, ext);

    if (content === null) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, error: 'Unsupported file type. Only .pdf, .txt, and .md files are supported.' });
    }

    if (!content || content.trim().length === 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, error: 'The uploaded file contains no readable text.' });
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const prisma = getPrisma();
    const articleId = uuidv4();
    const articleTitle = title || path.basename(req.file.originalname, ext).replace(/[-_]/g, ' ');
    const articleCrops = crops ? crops.split(',').map((c: string) => c.trim()) : [];
    const articleRegions = regions ? regions.split(',').map((r: string) => r.trim()) : ['tropical'];
    const articleTags = tags ? tags.split(',').map((t: string) => t.trim()) : [];
    const summary = content.substring(0, 300).trim() + (content.length > 300 ? '...' : '');

    const article = await prisma.knowledgeArticle.create({
        data: {
            id: articleId,
            title: articleTitle,
            content,
            contentType: 'text',
            summary,
            category,
            tags: articleTags,
            crops: articleCrops,
            regions: articleRegions,
            source: 'Dynamic Ingestion',
            sourceUrl: `/uploads/${req.file.filename}`
        }
    });

    await upsertVector(article);

    return res.status(201).json({
        success: true,
        data: {
            id: article.id,
            title: article.title,
            category: article.category,
            crops: article.crops,
            regions: article.regions,
            tags: article.tags,
            summary: article.summary
        },
    });
}

/**
 * @swagger
 * /api/v1/knowledge/ingest:
 *   post:
 *     summary: Ingest and vectorize a PDF, TXT, or MD file
 *     security:
 *       - BearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *       - in: formData
 *         name: title
 *         type: string
 *       - in: formData
 *         name: category
 *         type: string
 *       - in: formData
 *         name: crops
 *         type: string
 *       - in: formData
 *         name: regions
 *         type: string
 *       - in: formData
 *         name: tags
 *         type: string
 *     responses:
 *       201:
 *         description: Document ingested
 */
router.post('/ingest', authorize(knowledgeAdminRoles), knowledgeUpload.single('file'), async (req: Request, res: Response) => {
    try {
        await processKnowledgeIngestion(req, res);
    } catch (error) {
        logger.error('Document ingestion error:', error);
        safeError(res, 500, 'Failed to ingest document');
    }
});

// RAG v2 bootstrap
router.post('/ragv2/bootstrap', async (_req: Request, res: Response) => {
    try {
        const { RAGV2Service } = await import('@/services/ragV2Service');
        await RAGV2Service.initializeSchema();
        const chunks = await RAGV2Service.chunkAllArticles();
        const graph = await RAGV2Service.buildKnowledgeGraph();
        res.json({
            success: true,
            data: {
                chunks: chunks.chunks,
                articles: chunks.total,
                entities: graph.entities,
                relationships: graph.relationships
            }
        });
    } catch (error) {
        logger.error('RAG v2 bootstrap error:', error);
        safeError(res, 500, 'Failed to bootstrap RAG v2');
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
