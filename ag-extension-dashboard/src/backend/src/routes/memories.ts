/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { memoryListSchema } from '@/utils/schemas';
import { persistentMemory } from '@/services/persistentMemory';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Get memories with optional filtering
router.get('/', authorize(['admin', 'farmer']), validate(memoryListSchema), async (req: Request, res: Response) => {
    try {
        const category = req.query.category as string | undefined;
        const limit = Number(req.query.limit) || 50;
        const userId = (req as any).user?.userId || 'system';

        // Use recall method with empty query to get all memories
        const memories = await persistentMemory.recall({
            userId,
            query: '',
            category,
            limit
        });
        res.json({ success: true, data: memories });
    } catch (error) {
        logger.error('Failed to get memories:', error);
        safeError(res, 500, 'Failed to get memories');
    }
});

// Get memory summary by category
router.get('/summary', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId || 'system';
        const summary = await persistentMemory.getMemorySummary(userId);
        res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('Failed to get memory summary:', error);
        safeError(res, 500, 'Failed to get memory summary');
    }
});

// Store a new memory
router.post('/', authorize(['admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { category, key, value } = req.body;
        const userId = (req as any).user?.userId || 'system';

        if (!category || !key || !value) {
            return res.status(400).json({ success: false, error: 'Category, key, and value are required' });
        }

        // For now, we'll use a simple approach - the persistent memory service
        // doesn't have a direct store method, so we'll create a placeholder response
        logger.info(`Memory storage requested: ${category}:${key} for user ${userId}`);
        res.json({ success: true, message: 'Memory storage logged - functionality will be implemented' });
    } catch (error) {
        logger.error('Failed to store memory:', error);
        safeError(res, 500, 'Failed to store memory');
    }
});

// Delete a memory
router.delete('/:category/:key', authorize(['admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { category, key } = req.params;
        const userId = (req as any).user?.userId || 'system';

        const success = await persistentMemory.forget(userId, category, key);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to delete memory:', error);
        safeError(res, 500, 'Failed to delete memory');
    }
});

export default router;