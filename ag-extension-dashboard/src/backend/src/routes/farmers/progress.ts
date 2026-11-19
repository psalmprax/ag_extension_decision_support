import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '@/middleware/validationMiddleware';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';
import { getFarmerForPrincipal } from '@/services/dataGovernanceService';
import {
    PROGRESS_KINDS,
    createProgressEntry,
    listProgressEntries,
    visitBelongsToFarmer,
} from '@/services/farmerProgressService';
import { AttachmentError, MAX_ATTACHMENTS, assertAttachableImages } from '@/services/uploadAttachments';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/** Progress records belong with field visits: the same paid feature. */
const requireProgressPlan = requirePaidPlan('Field Visits & Tracking');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createEntrySchema = z.object({
    body: z.object({
        kind: z.enum(PROGRESS_KINDS),
        title: z.string().trim().min(1, 'title is required').max(200),
        details: z.string().trim().max(4000).optional(),
        crop: z.string().trim().max(100).optional(),
        occurredOn: z.string().regex(ISO_DATE, 'occurredOn must be YYYY-MM-DD'),
        visitId: z.string().uuid().optional(),
        attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS).optional(),
    }).strict(),
});

function principalOf(req: Request): { userId: string; role: string } | null {
    return req.user?.userId && req.user.role ? { userId: req.user.userId, role: req.user.role } : null;
}

/** Tomorrow in UTC: a record may be dated today wherever the officer is, never later. */
function latestAllowedDate(): string {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * GET /api/farmers/:id/progress — the farmer's progress log. Readable by the
 * farmer's officer, their regional manager, admins, and the farmer.
 */
router.get('/:id/progress', requireProgressPlan, async (req: Request, res: Response) => {
    try {
        const principal = principalOf(req);
        if (!principal) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (!(await getFarmerForPrincipal(req.params.id, principal))) {
            return res.status(403).json({ success: false, error: 'Access denied to farmer' });
        }
        return res.json({ success: true, data: await listProgressEntries(req.params.id) });
    } catch (error) {
        logger.error('Failed to load farmer progress:', error);
        return safeError(res, 500, 'Failed to load farmer progress');
    }
});

/**
 * POST /api/farmers/:id/progress — record a success, failure, field event,
 * action or observation. Staff only, and only for farmers they serve: an
 * officer's own farmers, a manager's region (getFarmerForPrincipal).
 */
router.post('/:id/progress', requireProgressPlan, validate(createEntrySchema), async (req: Request, res: Response) => {
    try {
        const principal = principalOf(req);
        if (!principal) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (principal.role === 'farmer') {
            return res.status(403).json({ success: false, error: 'Progress is recorded by extension staff' });
        }
        const farmer = await getFarmerForPrincipal(req.params.id, principal);
        if (!farmer) {
            return res.status(403).json({ success: false, error: 'You can only record progress for your own farmers' });
        }

        const body = req.body as z.infer<typeof createEntrySchema>['body'];
        if (body.occurredOn > latestAllowedDate()) {
            return res.status(400).json({ success: false, error: 'Progress can only be recorded for today or earlier' });
        }
        if (body.visitId && !(await visitBelongsToFarmer(body.visitId, farmer.id))) {
            return res.status(400).json({ success: false, error: 'The visit is not one of this farmer\'s visits' });
        }
        const attachmentIds = body.attachmentIds ?? [];
        await assertAttachableImages(attachmentIds, principal.userId, farmer.id);

        const entry = await createProgressEntry({
            farmerId: farmer.id,
            officerId: principal.userId,
            tenantId: farmer.tenant_id ?? null,
            visitId: body.visitId ?? null,
            kind: body.kind,
            title: body.title,
            details: body.details || null,
            crop: body.crop || null,
            occurredOn: body.occurredOn,
            attachmentIds,
        });
        return res.status(201).json({ success: true, data: entry });
    } catch (error) {
        if (error instanceof AttachmentError) return safeError(res, error.statusCode, error.message);
        logger.error('Failed to record farmer progress:', error);
        return safeError(res, 500, 'Failed to record farmer progress');
    }
});

export default router;
