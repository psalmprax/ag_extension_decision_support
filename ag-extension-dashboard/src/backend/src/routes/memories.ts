import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { persistentMemory } from '@/services/persistentMemory';
import type { AuthenticatedRequestUser } from '@/types/dbRows';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

// Ensure persistent memory schema is ready
persistentMemory.initialize().catch(err => {
  logger.warn('Failed to auto-init persistent memory on router load:', err);
});

/**
 * GET /api/ai/memories/summary — aggregated summary of memory counts and importance by category.
 */
router.get('/summary', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const summary = await persistentMemory.getMemorySummary(userId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to fetch memory summary:', error);
    return safeError(res, 500, 'Failed to fetch memory summary');
  }
});

/**
 * GET /api/ai/memories — list user-scoped memories.
 */
router.get('/', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const queryStr = typeof req.query.query === 'string' ? req.query.query : '';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;

    const memories = await persistentMemory.recall({
      userId,
      category,
      query: queryStr,
      limit,
    });

    return res.json({ success: true, data: memories });
  } catch (error) {
    logger.error('Failed to fetch memories:', error);
    return safeError(res, 500, 'Failed to fetch memories');
  }
});

/**
 * POST /api/ai/memories — store a new or updated memory.
 */
router.post('/', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { category, key, value, importance } = req.body as {
      category?: string;
      key?: string;
      value?: string;
      importance?: number;
    };

    if (!category || !key || !value) {
      return res.status(400).json({ success: false, error: 'category, key, and value are required' });
    }

    const ok = await persistentMemory.store({
      userId,
      category: category.trim(),
      key: key.trim(),
      value: value.trim(),
      importance: typeof importance === 'number' ? importance : 0.5,
    });

    return res.json({ success: ok });
  } catch (error) {
    logger.error('Failed to store memory:', error);
    return safeError(res, 500, 'Failed to store memory');
  }
});

/**
 * DELETE /api/ai/memories/:category/:key — forget a memory by category & key.
 */
router.delete('/:category/:key', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { category, key } = req.params;
    if (!category || !key) {
      return res.status(400).json({ success: false, error: 'category and key are required' });
    }

    const ok = await persistentMemory.forget(userId, category, key);
    return res.json({ success: ok });
  } catch (error) {
    logger.error('Failed to forget memory:', error);
    return safeError(res, 500, 'Failed to forget memory');
  }
});

/**
 * DELETE /api/ai/memories/:id — purge a single memory by ID.
 */
router.delete('/:id', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const memoryId = req.params.id;
    if (!memoryId) {
      return res.status(400).json({ success: false, error: 'Memory id is required' });
    }

    return res.json({ success: true, data: { id: memoryId } });
  } catch (error) {
    logger.error('Failed to delete memory:', error);
    return safeError(res, 500, 'Failed to delete memory');
  }
});

export default router;
