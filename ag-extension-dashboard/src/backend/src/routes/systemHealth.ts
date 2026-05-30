import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { selfHealingService } from '@/services/selfHealing';
import { logger } from '@/utils/logger';

const router = Router();

// Get health status of all components
router.get('/components', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const healthChecks = Array.from(selfHealingService.getHealthStatus().values());
        res.json({ success: true, data: healthChecks });
    } catch (error) {
        logger.error('Failed to get health checks:', error);
        res.status(500).json({ success: false, error: 'Failed to get health checks' });
    }
});

// Get recovery action log
router.get('/recovery-log', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const recoveryLog = selfHealingService.getRecoveryLog();
        res.json({ success: true, data: recoveryLog });
    } catch (error) {
        logger.error('Failed to get recovery log:', error);
        res.status(500).json({ success: false, error: 'Failed to get recovery log' });
    }
});

// Trigger recovery for a specific component
router.post('/recover/:component', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const { component } = req.params;
        // Note: Manual recovery triggering not implemented in service yet
        // This is a placeholder for future implementation
        logger.info(`Recovery requested for component: ${component}`);
        res.json({ success: true, message: 'Recovery request logged - automatic recovery will be attempted' });
    } catch (error) {
        logger.error(`Failed to process recovery request for ${req.params.component}:`, error);
        res.status(500).json({ success: false, error: 'Failed to process recovery request' });
    }
});

export default router;