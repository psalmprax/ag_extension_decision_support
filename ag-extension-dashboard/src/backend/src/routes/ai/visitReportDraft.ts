import { Router, Response, NextFunction } from 'express';
import { validate } from '@/middleware/validate';
import { aiSchemas } from '@/schemas';
import { AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '@/services/usageService';
import { draftVisitReport } from '@/services/visitReportDraft';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/** Visit reports are written by staff; the AI router above has already signed the user in. */
const STAFF_ROLES = new Set(['admin', 'regional_manager', 'extension_officer']);
function staffOnly(req: AuthRequest, res: Response, next: NextFunction): void {
    if (req.user && STAFF_ROLES.has(req.user.role)) {
        next();
        return;
    }
    res.status(403).json({ success: false, error: 'Only staff can draft visit reports' });
}

/**
 * @swagger
 * /api/ai/draft-visit-report:
 *   post:
 *     summary: Sort what an officer said about a visit into the visit report's fields
 *     description: The report is built only from the officer's own sentences; the officer checks it before saving.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/draft-visit-report',
    [staffOnly, checkUsageLimit('ai_chat', { meter: false }), validate({ body: aiSchemas.draftVisitReport })],
    async (req: AuthRequest, res: Response) => {
        try {
            const draft = await draftVisitReport(req.body.transcript);
            if (draft.organised) await usageService.incrementUsage(req.user!.userId, 'ai_chat');
            return res.json({ success: true, data: draft });
        } catch (error) {
            logger.error('Drafting the visit report failed:', error);
            return safeError(res, 500, 'Could not draft the visit report');
        }
    }
);

export default router;
