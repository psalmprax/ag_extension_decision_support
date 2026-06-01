import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { agentOrchestrator } from '@/services/agentOrchestrator';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

router.get('/status', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const agents = agentOrchestrator.getAgentStatus();
        res.json({ success: true, data: agents });
    } catch (error) {
        logger.error('Failed to get agent status:', error);
        safeError(res, 500, 'Failed to get agent status');
    }
});

router.get('/queue', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const queue = agentOrchestrator.getQueueStatus();
        res.json({ success: true, data: queue });
    } catch (error) {
        logger.error('Failed to get queue status:', error);
        safeError(res, 500, 'Failed to get queue status');
    }
});

router.get('/handoffs', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const handoffs = agentOrchestrator.getHandoffLog();
        res.json({ success: true, data: handoffs });
    } catch (error) {
        logger.error('Failed to get handoff log:', error);
        safeError(res, 500, 'Failed to get handoff log');
    }
});

router.post('/dispatch', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { type, payload, priority, agentId } = req.body;
        const task = await agentOrchestrator.dispatchTask({
            agentId: agentId || '',
            type,
            payload,
            priority: priority || 'medium',
            maxRetries: 3,
        });
        res.json({ success: true, data: task });
    } catch (error) {
        logger.error('Failed to dispatch task:', error);
        safeError(res, 500, 'Failed to dispatch task');
    }
});

export default router;
