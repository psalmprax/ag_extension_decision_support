import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { persistentMemory } from '@/services/persistentMemory';
import { logger } from '@/utils/logger';

const router = Router();

// Get memories with optional filtering
router.get('/', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const category = req.query.category as string | undefined;
        const limit = parseInt(req.query.limit as string || '50');
        const userId = (req as any).user?.userId || 'system'; // Use system for admin access

        const memories = await persistentMemory.getMemories(userId, category, limit);
        res.json({ success: true, data: memories });
    } catch (error) {
        logger.error('Failed to get memories:', error);
        res.status(500).json({ success: false, error: 'Failed to get memories' });
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
        res.status(500).json({ success: false, error: 'Failed to get memory summary' });
    }
});

// Store a new memory
router.post('/', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const { category, key, value, importance } = req.body;
        const userId = (req as any).user?.userId || 'system';

        if (!category || !key || !value) {
            return res.status(400).json({ success: false, error: 'Category, key, and value are required' });
        }

        const success = await persistentMemory.storeMemory(userId, category, key, value, importance || 0.5);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to store memory:', error);
        res.status(500).json({ success: false, error: 'Failed to store memory' });
    }
});

// Delete a memory
router.delete('/:category/:key', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const { category, key } = req.params;
        const userId = (req as any).user?.userId || 'system';

        const success = await persistentMemory.deleteMemory(userId, category, key);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to delete memory:', error);
        res.status(500).json({ success: false, error: 'Failed to delete memory' });
    }
});

export default router;