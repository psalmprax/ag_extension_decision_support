import { Router, Request, Response } from 'express';
import { shareService } from '@/services/shareService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

type EntityType = 'farmer' | 'visit' | 'report' | 'knowledge';

/**
 * Creates a share route for a given entity type.
 * Deduplicates the share endpoint pattern across farmers, knowledge, reporting routes.
 */
export function createShareRoute(entityType: EntityType): Router {
    const router = Router();

    router.post('/:id/share', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { isPublic, expiresAt, permissions } = req.body;
            const createdBy = req.user?.userId;

            const shareLink = await shareService.createShare({
                entityType,
                entityId: id,
                createdBy,
                isPublic,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                permissions,
            });

            res.status(201).json({ success: true, data: shareLink });
        } catch (error) {
            logger.error(`Error creating ${entityType} share:`, error);
            safeError(res, 500, 'Failed to create share link');
        }
    });

    return router;
}
