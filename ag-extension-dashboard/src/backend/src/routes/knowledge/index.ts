import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { authorize, optionalAuth } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { usageService } from '@/services/usageService';
import searchRouter from './search';
import metaRouter from './meta';
import articlesRouter from './articles';
import ingestRouter from './ingest';
import { createShareRoute } from '../shareRouteFactory';

const router = Router();

// Check daily knowledge query quota (3 per day for Free tier; admin is Unlimited; paid plans per subscription)
router.get('/quota', optionalAuth, async (req: Request, res: Response) => {
    try {
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string | undefined;
        const userRole = (user?.role) as string | undefined;
        if (!userId) {
            return res.json({
                success: true,
                data: {
                    allowed: true,
                    current: 0,
                    limit: 3,
                    remaining: 3,
                    isFree: true,
                }
            });
        }
        const quota = await usageService.checkDailyKnowledgeLimit(userId, userRole);
        const isFree = await usageService.isFreeUser(userId, userRole);
        return res.json({
            success: true,
            data: {
                ...quota,
                isFree,
            }
        });
    } catch (error) {
        logger.error('Failed to get knowledge quota:', error);
        safeError(res, 500, 'Failed to fetch knowledge quota');
    }
});

// Apply authentication to all knowledge routes below
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

router.use(searchRouter);
router.use(metaRouter);

// Share a knowledge article
router.use(createShareRoute('knowledge'));

router.use(articlesRouter);
router.use(ingestRouter);

export { seedKnowledgeArticles, seedKnowledgeArticlesData } from './articles';

export default router;
