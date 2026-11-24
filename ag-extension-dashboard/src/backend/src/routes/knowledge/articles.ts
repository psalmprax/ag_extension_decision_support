import { Router, Request, Response, NextFunction } from 'express';
import { isUuid } from '@/utils/uuid';
import { KnowledgeService } from '@/services/knowledgeService';
import { getPool, query } from '@/services/databaseService';
import type {
  KnowledgeArticleRow,
  KnowledgeArticleForVector,
} from '@/types/rowTypes';
import {
  mapKnowledgeArticleRow,
} from '@/types/dtos';
import { getPrisma } from '@/services/prismaService';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { VectorService } from '@/services/vectorService';
import { safeError } from '@/utils/safeResponse';
import { SEED_ARTICLE_SOURCE, seedKnowledgeArticlesData } from '@/services/knowledge/seedArticles';
import { isWebUrl } from '@/utils/webUrl';

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

export { seedKnowledgeArticlesData };

// Seed knowledge articles into database
export async function seedKnowledgeArticles(): Promise<void> {
    const pool = getPool();
    if (!pool) return;

    const articles = seedKnowledgeArticlesData.map(art => ({
        id: art.id,
        title: art.title,
        content: art.content,
        category: art.category,
        tags: art.tags,
        crops: [art.crop],
        regions: art.crop === 'maize' ? ['East Africa'] : ['tropical'],
        source: SEED_ARTICLE_SOURCE
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

// Get recent search history
router.get('/history', async (req: Request, res: Response) => {
    try {
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string | undefined;
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

// Get article by ID
// Only an id: other one-word paths (/sources, /my-officer) belong to routes mounted later.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    if (!isUuid(req.params.id)) return next();
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
        if (sourceUrl && !isWebUrl(sourceUrl)) {
            return res.status(400).json({ success: false, error: 'sourceUrl must be an http or https address' });
        }
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

/**
 * A partner's recording is published under its licence and credit: only an administrator
 * may change the transcript or who it is credited to.
 */
async function isPartnerArticleLockedFor(req: Request, articleId: string): Promise<boolean> {
    if ((req.user as { role?: string } | undefined)?.role === 'admin') return false;
    const { rows } = await query('SELECT 1 FROM partner_recordings WHERE knowledge_article_id = $1 LIMIT 1', [articleId]);
    return rows.length > 0;
}

/** Only the fields the request names change. */
function articleUpdateData(body: Record<string, unknown>, sanitizedContent: string | undefined): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const key of ['title', 'contentType', 'summary', 'category', 'tags', 'crops', 'regions', 'source', 'sourceUrl'] as const) {
        if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.content !== undefined) data.content = sanitizedContent;
    data.updatedAt = new Date();
    return data;
}

async function processUpdateArticle(req: Request, res: Response) {
    const { id } = req.params;
    const { content, contentType, sourceUrl } = req.body;
    if (sourceUrl && !isWebUrl(sourceUrl)) {
        return res.status(400).json({ success: false, error: 'sourceUrl must be an http or https address' });
    }
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

    if (await isPartnerArticleLockedFor(req, id)) {
        return res.status(403).json({
            success: false,
            error: "This article is a partner's licensed recording. An administrator can correct it.",
        });
    }

    if (contentType && !['text', 'html'].includes(contentType)) {
        return res.status(400).json({
            success: false,
            error: 'contentType must be either "text" or "html"',
        });
    }

    const sanitizedContent = content === undefined ? undefined : sanitizeKnowledgeContent(content, contentType || existingArticle.contentType || 'text');

    const updateData = articleUpdateData(req.body as Record<string, unknown>, sanitizedContent);

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

export default router;
