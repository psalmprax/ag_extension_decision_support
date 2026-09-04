import { Router, Request, Response } from 'express';
import { getPool, query } from '@/services/databaseService';
import type {
  KnowledgeArticleRow,
  KnowledgeCategoryRow,
  KnowledgeCropRow,
} from '@/types/rowTypes';
import {
  mapKnowledgeArticleRow,
  mapKnowledgeCategoryRows,
  mapKnowledgeCropRows,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Download a bounded, versioned knowledge pack for offline field use.
router.get('/offline-pack', async (req: Request, res: Response) => {
    try {
        const region = typeof req.query.region === 'string' ? req.query.region.trim() : undefined;
        const requestedLimit = Number(req.query.limit || 200);
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 200;
        const params: unknown[] = [];
        let regionFilter = '';
        if (region) {
            params.push(region);
            regionFilter = `AND (regions = '{}' OR $${params.length} = ANY(regions))`;
        }
        params.push(limit);
        const result = await query<KnowledgeArticleRow>(
            `SELECT id, title, content, content_type, summary, category, tags, crops, regions, source, source_url, updated_at
             FROM knowledge_articles
             WHERE 1 = 1 ${regionFilter}
             ORDER BY updated_at DESC NULLS LAST, "order" ASC
             LIMIT $${params.length}`,
            params
        );
        const pack = {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            region: region || null,
            articles: result.rows.map(article => mapKnowledgeArticleRow(article)),
        };
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="knowledge-pack-${region || 'global'}.json"`);
        return res.json({ success: true, data: pack });
    } catch (error) {
        logger.error('Offline knowledge pack error:', error);
        return safeError(res, 500, 'Failed to create offline knowledge pack');
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

export default router;
