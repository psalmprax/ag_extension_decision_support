import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { telemetrySummarySchema, telemetryEventsSchema } from '@/utils/schemas';
import { agentTelemetry } from '@/services/agentTelemetry';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

router.get('/summary', authorize(['extension_officer', 'admin', 'farmer']), validate(telemetrySummarySchema), async (req: Request, res: Response) => {
    try {
        const hours = Number(req.query.hours) || 24;
        const summary = await agentTelemetry.getSummary(hours);
        res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('Failed to get telemetry summary:', error);
        safeError(res, 500, 'Failed to get telemetry summary');
    }
});

router.get('/events', authorize(['extension_officer', 'admin', 'farmer']), validate(telemetryEventsSchema), async (req: Request, res: Response) => {
    try {
        const limit = Number(req.query.limit) || 50;
        const events = await agentTelemetry.getRecentEvents(limit);
        res.json({ success: true, data: events });
    } catch (error) {
        logger.error('Failed to get telemetry events:', error);
        safeError(res, 500, 'Failed to get telemetry events');
    }
});

export default router;
