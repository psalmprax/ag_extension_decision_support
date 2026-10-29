import { Router, Response } from 'express';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { findNearbySuppliersLive, verifyBatchNumber } from '@/services/inputSupplierService';
import {
    MECHANIZATION_ASSET_TYPES,
    MECHANIZATION_RATE_UNITS,
    findAvailableEquipment,
    planDroneSprayMission,
    registerEquipment,
} from '@/services/mechanizationFleetService';

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

const equipmentSchema = z.object({
    assetType: z.enum(MECHANIZATION_ASSET_TYPES),
    modelName: z.string().min(2).max(200),
    ownerName: z.string().min(2).max(200),
    ownerPhone: z.string().min(7).max(30),
    county: z.string().min(1).max(100),
    subCounty: z.string().min(1).max(100),
    ratePerUnitKes: z.number().int().positive(),
    rateUnit: z.enum(MECHANIZATION_RATE_UNITS),
    isAvailable: z.boolean().optional(),
    isVerified: z.boolean().optional(),
});

router.post('/mechanization/search', checkUsageLimit('ai_chat'), validate({ body: z.object({ county: z.string().min(1), assetType: z.enum(MECHANIZATION_ASSET_TYPES).optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await findAvailableEquipment(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// Registration is administrative: the registry backs farmer-facing search results.
router.post('/mechanization/assets', authorize(['admin']), validate({ body: equipmentSchema }), async (req: AuthRequest, res: Response) => {
    try { return res.status(201).json({ success: true, data: await registerEquipment(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/mechanization/drone-plan', checkUsageLimit('ai_chat'), validate({ body: z.object({ targetCrop: z.string().min(1), pestTarget: z.string().min(1), totalHectares: z.number().positive(), farmerIds: z.array(z.string()), tankCapacityLiters: z.number().optional(), applicationRateLPerHa: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: planDroneSprayMission(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
