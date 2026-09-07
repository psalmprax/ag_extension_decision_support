import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { findCrossBorderArbitrage } from '@/services/crossBorderTradeService';
import { aggregateHarvestProjections, matchOfftakerContracts } from '@/services/harvestOfftakeService';

const router = Router();

router.post('/trade/arbitrage', checkUsageLimit('ai_chat'), validate({ body: z.object({ commodity: z.string().min(1), minNetMarginPct: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: findCrossBorderArbitrage(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/offtake/aggregate', checkUsageLimit('ai_chat'), validate({ body: z.object({ crop: z.string().min(1), county: z.string().min(1), totalAcreage: z.number().positive() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: aggregateHarvestProjections(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/offtake/match', checkUsageLimit('ai_chat'), validate({ body: z.object({ crop: z.string().min(1), county: z.string().min(1), totalAcreage: z.number().positive() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: matchOfftakerContracts(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
