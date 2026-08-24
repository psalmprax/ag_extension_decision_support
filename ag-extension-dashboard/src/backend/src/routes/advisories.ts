import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validationMiddleware';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { seasonalAdvisoryService } from '@/services/seasonalAdvisoryService';

const router = Router();

type AuthedRequest = Request & { user?: { userId: string; role: string } };

const preferenceSchema = z.object({
    farmerId: z.string().uuid(),
    optIn: z.boolean(),
    channels: z.array(z.enum(['whatsapp', 'sms'])).max(5).optional(),
    categories: z.array(z.string().max(40)).max(10).optional(),
});

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * PUT /api/advisories/preferences — farmer opt-in/out and channel/category selection.
 */
router.put('/preferences', validate({ body: preferenceSchema }), async (req: AuthedRequest, res: Response) => {
    try {
        await seasonalAdvisoryService.setPreference(req.body.farmerId, {
            optIn: req.body.optIn,
            channels: req.body.channels,
            categories: req.body.categories,
        });
        const current = await seasonalAdvisoryService.getPreference(req.body.farmerId);
        return res.json({ success: true, data: current });
    } catch (error) {
        logger.error('Failed to save advisory preferences:', error);
        return safeError(res, 500, 'Failed to save advisory preferences');
    }
});

/**
 * GET /api/advisories/preferences/:farmerId
 */
router.get('/preferences/:farmerId', async (req: AuthedRequest, res: Response) => {
    try {
        const current = await seasonalAdvisoryService.getPreference(req.params.farmerId);
        return res.json({ success: true, data: current });
    } catch (error) {
        logger.error('Failed to load advisory preferences:', error);
        return safeError(res, 500, 'Failed to load advisory preferences');
    }
});

/**
 * GET /api/advisories/recent — dispatch log for the dashboard.
 */
router.get('/recent', async (req: AuthedRequest, res: Response) => {
    try {
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);
        const dispatches = await seasonalAdvisoryService.getRecentDispatches(limit);
        return res.json({ success: true, data: dispatches });
    } catch (error) {
        logger.error('Failed to load recent advisories:', error);
        return safeError(res, 500, 'Failed to load recent advisories');
    }
});

/**
 * POST /api/advisories/run-cycle — manual trigger (admin only, also runs on cron when enabled).
 */
router.post('/run-cycle', authorize(['admin']), async (_req: AuthedRequest, res: Response) => {
    try {
        if (config.nodeEnv === 'test') {
            return res.status(503).json({ success: false, error: 'Advisory cycle disabled in test environment' });
        }
        const result = await seasonalAdvisoryService.runDailyCycle();
        return res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Manual advisory cycle failed:', error);
        return safeError(res, 500, 'Advisory cycle failed');
    }
});

export default router;
