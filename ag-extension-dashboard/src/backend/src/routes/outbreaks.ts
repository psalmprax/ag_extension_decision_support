import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { outbreakService } from '@/services/outbreakService';

const router = Router();

type AuthedRequest = Request & { user?: { userId: string; role: string } };

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * GET /api/outbreaks — k-anonymized disease clusters for the heatmap.
 * Optional bbox=minLat,maxLat,minLng,maxLng to scope to the visible map area.
 */
router.get('/', async (req: AuthedRequest, res: Response) => {
    try {
        const days = Math.min(parseInt((req.query.days as string) || '14', 10) || 14, 90);
        let bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | undefined;

        if (typeof req.query.bbox === 'string') {
            const parts = req.query.bbox.split(',').map(Number);
            if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
                bbox = { minLat: parts[0], maxLat: parts[1], minLng: parts[2], maxLng: parts[3] };
            }
        }

        const clusters = await outbreakService.getClusters({ days, bbox });
        const threshold = 5;
        return res.json({
            success: true,
            data: clusters.map(c => ({ ...c, alert: c.caseCount >= threshold })),
            kAnonymityFloor: 3,
        });
    } catch (error) {
        logger.error('Failed to load outbreak clusters:', error);
        return safeError(res, 500, 'Failed to load outbreak clusters');
    }
});

export default router;
