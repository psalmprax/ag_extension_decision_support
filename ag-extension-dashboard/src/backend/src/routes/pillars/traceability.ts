import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { verifyEudrDeforestationCompliance, generateFarmToForkPassport } from '@/services/traceabilityPassportService';

const router = Router();

router.post('/traceability/eudr-verify', checkUsageLimit('ai_chat'), validate({ body: z.object({
    parcelId: z.string().min(1), country: z.string().min(1), commodity: z.enum(['coffee','cocoa','tea','soy','avocado']),
    centroid: z.tuple([z.number(), z.number()]), polygonVertexCount: z.number().int().min(3),
    forestCanopyBaseline2020Pct: z.number().min(0).max(100).optional(), currentForestCanopyPct: z.number().min(0).max(100).optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: verifyEudrDeforestationCompliance(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/traceability/passport', checkUsageLimit('ai_chat'), validate({ body: z.object({
    batchId: z.string().min(1), commodityName: z.string().min(1), tonnage: z.number().positive(), originCooperative: z.string().min(1),
    originCountry: z.string().min(1), farmCoordinates: z.tuple([z.number(), z.number()]), harvestDate: z.string().min(1),
    grade: z.string().optional(), fairTradeCertified: z.boolean().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: generateFarmToForkPassport(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
