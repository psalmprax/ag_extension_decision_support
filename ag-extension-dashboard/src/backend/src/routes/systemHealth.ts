import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { selfHealing } from '@/services/selfHealing';
import { logger } from '@/utils/logger';

const router = Router();

// Get health status of all components
router.get('/components', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const healthChecks = selfHealing.getHealthChecks();
        res.json({ success: true, data: healthChecks });
    } catch (error) {
        logger.error('Failed to get health checks:', error);
        res.status(500).json({ success: false, error: 'Failed to get health checks' });
    }
});

// Get recovery action log
router.get('/recovery-log', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const recoveryLog = selfHealing.getRecoveryLog();
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
        const success = await selfHealing.triggerRecovery(component);
        res.json({ success });
    } catch (error) {
        logger.error(`Failed to trigger recovery for ${req.params.component}:`, error);
        res.status(500).json({ success: false, error: 'Failed to trigger recovery' });
    }
});

export default router;