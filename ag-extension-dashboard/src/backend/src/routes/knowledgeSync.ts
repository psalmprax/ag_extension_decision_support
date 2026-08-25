import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// All sync/RAG endpoints require authentication
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * @swagger
 * /api/v1/knowledge/sync:
 *   post:
 *     summary: Trigger full knowledge base sync (curated articles + FAOSTAT data)
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync results
 */
router.post('/', async (_req: Request, res: Response) => {
    try {
        const { KnowledgeSyncOrchestrator } = await import('@/services/data/knowledgeSyncOrchestrator');
        const results = await KnowledgeSyncOrchestrator.syncAll();
        res.json({ success: true, data: results });
    } catch (error) {
        logger.error('Knowledge sync error:', error);
        safeError(res, 500, 'Failed to sync knowledge sources');
    }
});

/**
 * @swagger
 * /api/v1/knowledge/sync/status:
 *   get:
 *     summary: Get knowledge sync status
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync status
 */
router.get('/status', async (_req: Request, res: Response) => {
    try {
        const { KnowledgeSyncOrchestrator } = await import('@/services/data/knowledgeSyncOrchestrator');
        const status = KnowledgeSyncOrchestrator.getStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        safeError(res, 500, 'Failed to get sync status');
    }
});

export default router;