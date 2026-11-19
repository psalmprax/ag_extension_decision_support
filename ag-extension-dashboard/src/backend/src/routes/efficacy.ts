import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validationMiddleware';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { adviceEfficacyService, OUTCOME_VERDICTS } from '@/services/adviceEfficacyService';
import { getFarmerForPrincipal } from '@/services/dataGovernanceService';
import { query } from '@/services/databaseService';

const router = Router();

type AuthedRequest = Request & { user?: { userId: string; role: string } };

const outcomeSchema = z.object({
    visitId: z.string().uuid().optional(),
    farmerId: z.string().uuid().optional(),
    crop: z.string().min(1).max(100),
    adviceCategory: z.string().min(1).max(100),
    adviceSummary: z.string().min(1).max(4000),
    outcome: z.enum(OUTCOME_VERDICTS as [string, ...string[]]),
    followUpPhotoId: z.string().uuid().optional(),
    officerNotes: z.string().max(4000).optional(),
});

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * The farmer an outcome is recorded against, or null when the principal may
 * not record against it: an officer only for their own farmers, a manager
 * only in their region (getFarmerForPrincipal). A visit decides the farmer.
 */
async function outcomeFarmer(req: AuthedRequest): Promise<{ farmerId: string | null } | null> {
    const principal = { userId: req.user!.userId, role: req.user!.role };
    let farmerId: string | null = req.body.farmerId ?? null;
    if (req.body.visitId) {
        const visit = await query<{ farmer_id: string | null }>('SELECT farmer_id FROM visits WHERE id = $1', [req.body.visitId]);
        const visitFarmer = visit.rows[0]?.farmer_id ?? null;
        if (!visitFarmer || (farmerId && farmerId !== visitFarmer)) return null;
        farmerId = visitFarmer;
    }
    if (farmerId && !(await getFarmerForPrincipal(farmerId, principal))) return null;
    return { farmerId };
}

/**
 * POST /api/efficacy/outcomes — record the measured result of previously given advice.
 */
router.post('/outcomes', validate({ body: outcomeSchema }), async (req: AuthedRequest, res: Response) => {
    try {
        const scope = await outcomeFarmer(req);
        if (!scope) {
            return res.status(403).json({ success: false, error: 'You can only record outcomes for your own farmers' });
        }
        const record = await adviceEfficacyService.recordOutcome({
            visitId: req.body.visitId ?? null,
            farmerId: scope.farmerId,
            officerId: req.user!.userId,
            crop: req.body.crop,
            adviceCategory: req.body.adviceCategory,
            adviceSummary: req.body.adviceSummary,
            outcome: req.body.outcome,
            followUpPhotoId: req.body.followUpPhotoId ?? null,
            officerNotes: req.body.officerNotes ?? null,
        });
        return res.status(201).json({ success: true, data: record });
    } catch (error) {
        logger.error('Failed to record recommendation outcome:', error);
        return safeError(res, 500, 'Failed to record recommendation outcome');
    }
});

/**
 * GET /api/efficacy/summary — aggregated success rates by crop/advice category.
 */
router.get('/summary', async (req: AuthedRequest, res: Response) => {
    try {
        const days = Math.min(parseInt((req.query.days as string) || '90', 10) || 90, 365);
        const crop = typeof req.query.crop === 'string' ? req.query.crop : undefined;
        // Officers see their own efficacy; managers/admins see region-wide.
        const officerId = req.user!.role === 'extension_officer' ? req.user!.userId : undefined;
        const summary = await adviceEfficacyService.getEfficacySummary({ officerId, crop, days });
        return res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('Failed to load efficacy summary:', error);
        return safeError(res, 500, 'Failed to load efficacy summary');
    }
});

/**
 * GET /api/efficacy/followups — completed advice visits past their follow-up window with no recorded outcome.
 */
router.get('/followups', async (req: AuthedRequest, res: Response) => {
    try {
        const queue = await adviceEfficacyService.getFollowUpQueue(req.user!.userId);
        return res.json({ success: true, data: queue });
    } catch (error) {
        logger.error('Failed to load follow-up queue:', error);
        return safeError(res, 500, 'Failed to load follow-up queue');
    }
});

export default router;
