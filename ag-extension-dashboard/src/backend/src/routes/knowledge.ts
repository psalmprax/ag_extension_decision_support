/* eslint-disable @typescript-eslint/no-explicit-any */
import { shareService } from "@/services/shareService";
import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { getPool, query } from '@/services/databaseService';
import { getPrisma } from '@/services/prismaService';
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

            sql += ' ORDER BY order ASC, created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
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

router.post("/:id/share", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isPublic, expiresAt, permissions } = req.body;
        const createdBy = req.user?.id;

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
router.post('/reorder', async (req: Request, res: Response) => {
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
router.post('/', async (req: Request, res: Response) => {
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

        // Sanitize HTML content if contentType is html
        let sanitizedContent = content;
        if (contentType === 'html') {
            // Basic HTML sanitization - remove dangerous tags
            sanitizedContent = content.replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                .replace(/<object[^>]*>.*?<\/object>/gi, '')
                .replace(/<embed[^>]*>.*?<\/embed>/gi, '');
        }

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
router.put('/:id', async (req: Request, res: Response) => {
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

        // Sanitize HTML content if contentType is html
        let sanitizedContent = content;
        if ((contentType === 'html' || existingArticle.contentType === 'html') && content) {
            sanitizedContent = content.replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                .replace(/<object[^>]*>.*?<\/object>/gi, '')
                .replace(/<embed[^>]*>.*?<\/embed>/gi, '');
        }

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
