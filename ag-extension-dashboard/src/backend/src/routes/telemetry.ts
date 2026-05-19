import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { agentTelemetry } from '@/services/agentTelemetry';
import { logger } from '@/utils/logger';

const router = Router();

router.get('/summary', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const hours = parseInt((req.query.hours as string) || '24');
        const summary = await agentTelemetry.getSummary(hours);
        res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('Failed to get telemetry summary:', error);
        res.status(500).json({ success: false, error: 'Failed to get telemetry summary' });
    }
});

router.get('/events', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const limit = parseInt((req.query.limit as string) || '50');
        const events = await agentTelemetry.getRecentEvents(limit);
        res.json({ success: true, data: events });
    } catch (error) {
        logger.error('Failed to get telemetry events:', error);
        res.status(500).json({ success: false, error: 'Failed to get telemetry events' });
    }
});

export default router;
