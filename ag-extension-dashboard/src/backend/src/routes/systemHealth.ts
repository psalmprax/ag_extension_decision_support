import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { selfHealingService } from '@/services/selfHealing';
import { logger } from '@/utils/logger';
import { getPoolStats } from '@/services/databaseService';
import { getEmbeddingCacheStats } from '@/services/embeddingCache';
import { credentialVault } from '@/services/security/credentialVault';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Get infrastructure metrics (database pool, embedding cache)
router.get('/metrics', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const dbPool = getPoolStats();
        const embeddingCache = getEmbeddingCacheStats();

        res.json({
            success: true,
            data: {
                database: {
                    connected: dbPool.connected,
                    pool: {
                        total: dbPool.totalCount,
                        idle: dbPool.idleCount,
                        waiting: dbPool.waitingCount,
                        utilization: dbPool.totalCount > 0
                            ? Math.round(((dbPool.totalCount - dbPool.idleCount) / dbPool.totalCount) * 100)
                            : 0
                    }
                },
                embeddingCache: {
                    size: embeddingCache.size,
                    maxSize: embeddingCache.maxSize,
                    utilization: Math.round((embeddingCache.size / embeddingCache.maxSize) * 100)
                }
            }
        });
    } catch (error) {
        logger.error('Failed to get infrastructure metrics:', error);
        safeError(res, 500, 'Failed to get infrastructure metrics');
    }
});

// Get health status of all components
router.get('/components', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const healthChecks = Array.from(selfHealingService.getHealthStatus().values());
        res.json({ success: true, data: healthChecks });
    } catch (error) {
        logger.error('Failed to get health checks:', error);
        safeError(res, 500, 'Failed to get health checks');
    }
});

// Get recovery action log
router.get('/recovery-log', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const recoveryLog = selfHealingService.getRecoveryLog();
        res.json({ success: true, data: recoveryLog });
    } catch (error) {
        logger.error('Failed to get recovery log:', error);
        safeError(res, 500, 'Failed to get recovery log');
    }
});

// Trigger a bounded recovery action for a registered component
router.post('/recover/:component', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const result = await selfHealingService.requestRecovery(req.params.component);
        const statusCode = result.status === 'completed'
            ? 200
            : result.status === 'rejected' || result.status === 'not_found'
                ? 400
                : 503;
        return res.status(statusCode).json({
            success: result.success,
            data: result,
            ...(result.success ? {} : { error: result.details }),
        });
    } catch (error) {
        logger.error(`Failed to process recovery request for ${req.params.component}:`, error);
        return safeError(res, 500, 'Failed to process recovery request');
    }
});

// Credential rotation backlog (names + expiry only — never secret material).
router.get('/vault', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const overdue = credentialVault.listOverdueCredentials().map(c => ({
            name: c.name,
            category: c.category,
            expiresAt: c.expiresAt,
            accessCount: c.accessCount,
        }));
        const expiring = credentialVault.getExpiringCredentials(7)
            .filter(c => !overdue.some(o => o.name === c.name && o.category === c.category))
            .map(c => ({ name: c.name, category: c.category, expiresAt: c.expiresAt }));
        res.json({ success: true, data: { overdue, expiringWithin7Days: expiring } });
    } catch (error) {
        logger.error('Failed to get vault rotation status:', error);
        safeError(res, 500, 'Failed to get vault rotation status');
    }
});

export default router;