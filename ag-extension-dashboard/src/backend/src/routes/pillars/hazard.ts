import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { evaluateWeatherHazardsWithProvenance } from '@/services/weatherHazardDaemonService';

const router = Router();

const forecastSchema = z.array(z.object({
    date: z.string().trim().min(1).max(40),
    minTempC: z.number().finite(), maxTempC: z.number().finite(),
    precipitationMm: z.number().finite().nonnegative(),
    relativeHumidityPct: z.number().finite().min(0).max(100),
    windSpeedKmh: z.number().finite().nonnegative(),
}).refine(day => day.minTempC <= day.maxTempC, { message: 'Minimum temperature must not exceed maximum' })).min(1).max(14);

router.post('/hazard/evaluate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    forecast: forecastSchema,
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: evaluateWeatherHazardsWithProvenance(req.body.forecast as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
