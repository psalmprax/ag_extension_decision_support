import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/**
 * Diagnostic snapshot returned by GET /api/diagnostics/cached.
 * `payload` is opaque JSON stored from the last full diagnostic run.
 */
interface CachedDiagnosticSnapshot {
  generatedAt: string;
  payload: Record<string, unknown>;
}

let cachedResult: CachedDiagnosticSnapshot | null = null;

/**
 * GET /api/diagnostics/cached — return the latest in-memory diagnostic snapshot.
 */
router.get('/cached', async (_req: Request, res: Response) => {
    try {
        if (!cachedResult) {
            return res.status(404).json({ success: false, error: 'No diagnostic snapshot has been captured yet' });
        }
        return res.json({ success: true, data: cachedResult });
    } catch (error) {
        logger.error('Failed to fetch cached diagnostics:', error);
        return safeError(res, 500, 'Failed to fetch cached diagnostics');
    }
});

/**
 * POST /api/diagnostics/cached — replace the in-memory diagnostic snapshot.
 * Used by the diagnostic worker after a fresh run completes.
 */
router.post('/cached', async (req: Request, res: Response) => {
    try {
        const body = req.body as Partial<CachedDiagnosticSnapshot>;
        if (!body || typeof body !== 'object' || !body.payload) {
            return res.status(400).json({ success: false, error: 'payload object is required' });
        }
        cachedResult = {
            generatedAt: body.generatedAt ?? new Date().toISOString(),
            payload: body.payload,
        };
        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to persist cached diagnostics:', error);
        return safeError(res, 500, 'Failed to persist cached diagnostics');
    }
});

/**
 * DELETE /api/diagnostics/cached — clear the in-memory snapshot (used by tests).
 */
router.delete('/cached', async (_req: Request, res: Response) => {
    try {
        cachedResult = null;
        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to clear cached diagnostics:', error);
        return safeError(res, 500, 'Failed to clear cached diagnostics');
    }
});

export default router;
