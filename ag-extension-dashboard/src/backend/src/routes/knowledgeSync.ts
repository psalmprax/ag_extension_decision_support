import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { KnowledgeSyncInProgressError, KnowledgeSyncOrchestrator } from '@/services/data/knowledgeSyncOrchestrator';

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
 *       409:
 *         description: A sync is already in progress in this server process
 */
router.post('/', async (_req: Request, res: Response) => {
    try {
        const results = await KnowledgeSyncOrchestrator.syncAll();
        res.json({ success: true, data: results });
    } catch (error) {
        if (error instanceof KnowledgeSyncInProgressError) {
            return safeError(res, 409, 'Knowledge sync is already in progress');
        }
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
        const status = KnowledgeSyncOrchestrator.getStatus();
        res.json({ success: true, data: status });
    } catch (_error) {
        safeError(res, 500, 'Failed to get sync status');
    }
});

export default router;