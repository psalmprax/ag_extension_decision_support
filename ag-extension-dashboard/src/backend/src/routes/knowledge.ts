/* eslint-disable @typescript-eslint/no-explicit-any */
import { shareService } from "@/services/shareService";
import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { getPool, query } from '@/services/databaseService';
import { getPrisma } from '@/services/prismaService';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { tavilyService } from '@/services/tavilyService';
import { VectorService } from '@/services/vectorService';

const router = Router();
const knowledgeAdminRoles: UserRole[] = ['admin', 'regional_manager', 'extension_officer'];

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

// Apply authentication to all knowledge routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

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

// Search knowledge base
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q, category, crop, limit = '10', offset = '0' } = req.query;

        const cacheKey = 'knowledge:search:' + q + ':' + category + ':' + crop + ':' + limit + ':' + offset;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        let articles: any[] = [];
        const pool = getPool();

        if (pool && q) {
            articles = await KnowledgeService.searchKnowledge(q as string, parseInt(limit as string), {
                category: category as string | undefined,
                crop: crop as string | undefined
            });
        } else if (pool) {
            let sql = 'SELECT * FROM knowledge_articles WHERE 1=1';
            let countSql = 'SELECT COUNT(*) as count FROM knowledge_articles WHERE 1=1';
            const params: any[] = [];
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
            const countResult = await query(countSql, params);
            params.push(parseInt(limit as string), parseInt(offset as string));

            const result = await query(sql, params);
            articles = result.rows;
            (articles as any).totalCount = parseInt(countResult.rows[0]?.count || '0', 10);
        }

        // Fallback or empty if no results
        if (!articles || articles.length === 0) {
            articles = [];
        }

        const total = (articles as any).totalCount ?? articles.length;
        const response = {
            success: true,
            data: {
                articles,
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            },
        };

        await cacheSet(cacheKey, JSON.stringify(response), 300);
        res.json(response);
    } catch (error) {
        logger.error('Knowledge search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Get recent search history
router.get('/history', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId || (req as any).user?.id;
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
        res.status(500).json({ 
            success: false, 
            errorCode: 'SEARCH_HISTORY_FAILED',
            error: 'Failed to get search history' 
        });
    }
});

// Get search statistics for visuals
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const stats = await KnowledgeService.getSearchStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Get search stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get search statistics' });
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

        const results = await tavilyService.search(q as string, parseInt(limit as string));

        if (!results) {
            return res.status(500).json({ success: false, error: 'Search failed' });
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
        res.status(500).json({ success: false, error: 'Failed to search external sources' });
    }
});

// Get all categories
router.get('/meta/categories', async (_req: Request, res: Response) => {
    try {
        const pool = getPool();
        let categories: string[] = [];

        if (pool) {
            const result = await query('SELECT DISTINCT category FROM knowledge_articles ORDER BY category');
            categories = result.rows.map((r: any) => r.category);
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
            const result = await query("SELECT DISTINCT unnest(crops) as crop FROM knowledge_articles WHERE crops IS NOT NULL");
            crops = result.rows.map((r: any) => r.crop);
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

// Get article by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let article = null;
        if (pool) {
            const result = await query('SELECT * FROM knowledge_articles WHERE id = $1', [id]);
            article = result.rows[0];
        }

        if (!article) {
            return res.status(errorStatusMap['ARTICLE_NOT_FOUND']).json({ 
                success: false, 
                errorCode: 'ARTICLE_NOT_FOUND',
                error: 'Article not found' 
            });
        }

        res.json({ success: true, data: article });
    } catch (error) {
        logger.error('Get article error:', error);
        res.status(500).json({ 
            success: false, 
            errorCode: 'INTERNAL_SERVER_ERROR',
            error: 'Failed to get article' 
        });
    }
});


// Ask AI a question (RAG-based with Semantic Caching)
router.post('/ask', async (req: Request, res: Response) => {
    try {
        const { question } = req.body;
        const userId = (req as any).user?.userId || (req as any).user?.id;

        if (!question) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }

        const result = await KnowledgeService.askQuestion(userId, question);

        res.json({
            success: true,
            data: {
                answer: result.answer,
                reasoning: result.reasoning,
                visuals: result.visuals,
                audio: (result as any).audio,
                contextUsed: result.contextUsed,
                cached: result.cached
            },
        });
    } catch (error) {
        logger.error('Ask question error:', error);
        res.status(500).json({ success: false, error: 'Failed to get answer' });
    }
});


router.post("/:id/share", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isPublic, expiresAt, permissions } = req.body;
        const createdBy = (req as any).user?.id;

        const shareLink = await shareService.createShare({
            entityType: "knowledge",
            entityId: id,
            createdBy,
            isPublic,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            permissions,
        });

        res.status(201).json({
            success: true,
            data: shareLink,
        });
    } catch (error) {
        logger.error("Error creating knowledge share:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create share link",
        });
    }
});

/**
 * @openapi
 * /api/knowledge/reorder:
 *   post:
 *     summary: Reorder knowledge articles for drag-and-drop functionality
 *     tags: [Knowledge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, order]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     order: { type: integer }
 *     responses:
 *       200:
 *         description: Articles reordered successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/reorder', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { items } = req.body;
        const prisma = getPrisma();

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required',
                aria: { role: 'alert', label: 'Reorder failed: Invalid data provided' }
            });
        }

        // Validate each item has id and order
        for (const item of items) {
            if (!item.id || typeof item.order !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: 'Each item must have id and order',
                    aria: { role: 'alert', label: 'Reorder failed: Invalid item format' }
                });
            }
        }

        // Get article IDs to check existence
        const articleIds = items.map(item => item.id);
        const articles = await prisma.knowledgeArticle.findMany({
            where: { id: { in: articleIds } },
            select: { id: true }
        });

        if (articles.length !== items.length) {
            return res.status(400).json({
                success: false,
                error: 'Some articles not found',
                aria: { role: 'alert', label: 'Reorder failed: Some articles not found' }
            });
        }

        // Update orders in transaction
        await prisma.$transaction(
            items.map(item =>
                prisma.knowledgeArticle.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        );

        res.json({
            success: true,
            message: 'Articles reordered successfully',
            aria: { role: 'status', label: 'Articles reordered successfully' }
        });
    } catch (error) {
        logger.error('Reorder articles error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reorder articles',
            aria: { role: 'alert', label: 'Reorder failed: Internal server error' }
        });
    }
});

/**
 * @openapi
 * /api/knowledge:
 *   post:
 *     summary: Create a new knowledge article
 *     tags: [Knowledge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               contentType: { type: string, enum: [text, html], default: text }
 *               summary: { type: string }
 *               category: { type: string }
 *               tags: { type: array, items: { type: string } }
 *               crops: { type: array, items: { type: string } }
 *               regions: { type: array, items: { type: string } }
 *               source: { type: string }
 *               sourceUrl: { type: string }
 *     responses:
 *       201:
 *         description: Article created
 */
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
                aria: { role: 'alert', label: 'Article creation failed: Title and content required' }
            });
        }

        // Validate contentType
        if (!['text', 'html'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: 'contentType must be either "text" or "html"',
                aria: { role: 'alert', label: 'Article creation failed: Invalid content type' }
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

        res.status(201).json({
            success: true,
            data: article,
            aria: { role: 'status', label: 'Article created successfully' }
        });
    } catch (error) {
        logger.error('Create article error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create article',
            aria: { role: 'alert', label: 'Article creation failed: Internal server error' }
        });
    }
});

/**
 * @openapi
 * /api/knowledge/{id}:
 *   put:
 *     summary: Update a knowledge article
 *     tags: [Knowledge]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               contentType: { type: string, enum: [text, html] }
 *               summary: { type: string }
 *               category: { type: string }
 *               tags: { type: array, items: { type: string } }
 *               crops: { type: array, items: { type: string } }
 *               regions: { type: array, items: { type: string } }
 *               source: { type: string }
 *               sourceUrl: { type: string }
 *     responses:
 *       200:
 *         description: Article updated
 */
router.put('/:id', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            title, content, contentType, summary, category,
            tags, crops, regions, source, sourceUrl
        } = req.body;
        const prisma = getPrisma();

        // Check if article exists
        const existingArticle = await prisma.knowledgeArticle.findUnique({
            where: { id }
        });

        if (!existingArticle) {
            return res.status(404).json({
                success: false,
                error: 'Article not found',
                aria: { role: 'alert', label: 'Article update failed: Article not found' }
            });
        }

        // Validate contentType if provided
        if (contentType && !['text', 'html'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: 'contentType must be either "text" or "html"',
                aria: { role: 'alert', label: 'Article update failed: Invalid content type' }
            });
        }

        const sanitizedContent = content === undefined ? undefined : sanitizeKnowledgeContent(content, contentType || existingArticle.contentType || 'text');

        const updateData: any = {};
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

        res.json({
            success: true,
            data: article,
            aria: { role: 'status', label: 'Article updated successfully' }
        });
    } catch (error) {
        logger.error('Update article error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update article',
            aria: { role: 'alert', label: 'Article update failed: Internal server error' }
        });
    }
});

export default router;
