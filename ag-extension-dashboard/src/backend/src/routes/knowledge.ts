/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { getPool, query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication to all knowledge routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

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
];

// Seed knowledge articles into database
export async function seedKnowledgeArticles(): Promise<void> {
    const pool = getPool();
    if (!pool) return;

    const articles = [
        {
            title: 'Maize Disease Management',
            content: 'Common maize diseases include Northern leaf blight, Southern rust, and Grey leaf spot. Prevention strategies include crop rotation, using resistant varieties, and proper plant spacing. For Northern leaf blight, apply fungicides at the first sign of symptoms.',
            category: 'Crop Management',
            tags: ['maize', 'diseases', 'prevention'],
            crops: ['maize'],
            regions: ['East Africa'],
        },
        {
            title: 'Soil Fertility Management',
            content: 'Regular soil testing helps determine nutrient requirements. Organic matter addition through compost or manure improves soil structure and water retention. Apply nitrogen in split doses for optimal uptake.',
            category: 'Soil Health',
            tags: ['soil', 'fertility', 'organic'],
            crops: ['all'],
            regions: ['all'],
        },
        {
            title: 'Climate-Smart Agriculture',
            content: 'Climate-smart agriculture practices include conservation agriculture, agroforestry, and water harvesting techniques. These methods help adapt to changing weather patterns while reducing greenhouse gas emissions.',
            category: 'Climate',
            tags: ['climate', 'weather', 'adaptation'],
            crops: ['all'],
            regions: ['all'],
        },
        {
            title: 'Pest Control in Vegetables',
            content: 'Integrated Pest Management (IPM) combines biological, cultural, and chemical methods. Common vegetable pests include aphids, whiteflies, and fruit borers. Use neem oil for organic control.',
            category: 'Pest Management',
            tags: ['pests', 'vegetables', 'IPM'],
            crops: ['vegetables'],
            regions: ['all'],
        },
        {
            title: 'Post-Harvest Handling',
            content: 'Proper post-harvest practices include timely harvesting, appropriate storage conditions, and processing techniques. Store produce at cool temperatures when possible. Use proper packaging to prevent damage.',
            category: 'Post-Harvest',
            tags: ['harvest', 'storage', 'processing'],
            crops: ['all'],
            regions: ['all'],
        },
    ];

    try {
        const result = await query('SELECT COUNT(*) as count FROM knowledge_articles');
        const count = result?.rows?.[0]?.count;

        if (count === '0' || count === 0) {
            for (const article of articles) {
                await query(
                    'INSERT INTO knowledge_articles (title, content, category, tags, crops, regions) VALUES ($1, $2, $3, $4, $5, $6)',
                    [article.title, article.content, article.category, article.tags, article.crops, article.regions]
                );
            }
            logger.info('Knowledge articles seeded successfully');
        }
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
            articles = await KnowledgeService.searchKnowledge(q as string, parseInt(limit as string));
        } else if (pool) {
            let sql = 'SELECT * FROM knowledge_articles WHERE 1=1';
            const params: any[] = [];
            let paramIndex = 1;

            if (category) {
                sql += ' AND category = $' + paramIndex;
                params.push(category);
                paramIndex++;
            }

            sql += ' ORDER BY created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
            params.push(parseInt(limit as string), parseInt(offset as string));

            const result = await query(sql, params);
            articles = result.rows;
        }

        // Fallback or empty if no results
        if (!articles || articles.length === 0) {
            articles = [];
        }

        const total = articles.length;
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
            return res.status(404).json({ success: false, error: 'Article not found' });
        }

        res.json({ success: true, data: article });
    } catch (error) {
        logger.error('Get article error:', error);
        res.status(500).json({ success: false, error: 'Failed to get article' });
    }
});

// Ask AI a question (RAG-based)
router.post('/ask', async (req: Request, res: Response) => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { question, context: _context } = req.body;

        if (!question) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }

        const result = await KnowledgeService.askQuestion(question);

        res.json({
            success: true,
            data: {
                answer: result.answer,
                contextUsed: result.contextUsed,
            },
        });
    } catch (error) {
        logger.error('Ask question error:', error);
        res.status(500).json({ success: false, error: 'Failed to get answer' });
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

export default router;
