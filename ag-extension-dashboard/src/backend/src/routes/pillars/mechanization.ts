import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { findNearbySuppliersLive, verifyBatchNumber } from '@/services/inputSupplierService';
import { findAvailableEquipment, planDroneSprayMission } from '@/services/mechanizationFleetService';

const router = Router();

router.post('/suppliers/nearby', checkUsageLimit('ai_chat'), validate({ body: z.object({ lat: z.number(), lng: z.number(), radiusKm: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { dealers, provenance } = await findNearbySuppliersLive(req.body);
        return res.json({ success: true, data: { dealers, provenance } });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/suppliers/verify-batch', checkUsageLimit('ai_chat'), validate({ body: z.object({ batchNumber: z.string().min(1) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: verifyBatchNumber(req.body.batchNumber) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/mechanization/search', checkUsageLimit('ai_chat'), validate({ body: z.object({ county: z.string().min(1), assetType: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: findAvailableEquipment(req.body as never).equipment }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/mechanization/drone-plan', checkUsageLimit('ai_chat'), validate({ body: z.object({ targetCrop: z.string().min(1), pestTarget: z.string().min(1), totalHectares: z.number().positive(), farmerIds: z.array(z.string()), tankCapacityLiters: z.number().optional(), applicationRateLPerHa: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: planDroneSprayMission(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
