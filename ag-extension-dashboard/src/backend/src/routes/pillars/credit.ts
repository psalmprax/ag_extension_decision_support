import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { computeAgronomicCreditScore, evaluateParametricInsuranceClaim } from '@/services/agriCreditInsuranceService';

const router = Router();

router.post('/credit/score', checkUsageLimit('ai_chat'), validate({ body: z.object({
    farmerId: z.string().min(1), farmerName: z.string().min(1), acreage: z.number().positive(),
    advisoryCompliancePct: z.number().min(0).max(100), completedCropCycles: z.number().int().min(0),
    historicalYieldAttainmentPct: z.number().min(0).max(100), hasSoilTest: z.boolean(),
    soilOrganicMatterPct: z.number().min(0).max(100).optional(), fulfilledOfftakeDeliveriesPct: z.number().min(0).max(100),
    hasDiversifiedCrops: z.boolean(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: computeAgronomicCreditScore(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/credit/insurance-evaluate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    policy: z.object({ policyId: z.string(), farmerId: z.string(), crop: z.string(), acreage: z.number(), coverageType: z.string(), sumInsuredKes: z.number(), premiumKes: z.number(), strikeThresholdValue: z.number(), monitoringWindowDays: z.number(), status: z.string() }),
    observedMetric: z.number(), verificationSource: z.string().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try {
        const { policy, observedMetric, verificationSource } = req.body as { policy: Parameters<typeof evaluateParametricInsuranceClaim>[0]; observedMetric: number; verificationSource?: string };
        return res.json({ success: true, data: evaluateParametricInsuranceClaim(policy as never, observedMetric, verificationSource) });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
