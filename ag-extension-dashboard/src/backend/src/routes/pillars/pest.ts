import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { clusterPestSightings, forecastSwarmTrajectory } from '@/services/pestSwarmRadarService';

const router = Router();

router.post('/pest/cluster', checkUsageLimit('ai_chat'), validate({ body: z.object({
    sightings: z.array(z.object({ id: z.string(), pestType: z.string(), lat: z.number(), lng: z.number(), county: z.string(), severity: z.string(), reportedAt: z.string(), reporterRole: z.string() })), epsilonKm: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: clusterPestSightings(req.body.sightings as never, req.body.epsilonKm) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/pest/forecast', checkUsageLimit('ai_chat'), validate({ body: z.object({
    cluster: z.object({ clusterId: z.string(), pestType: z.string(), centroid: z.tuple([z.number(), z.number()]), sightingCount: z.number(), radiusKm: z.number(), severityLevel: z.string() }),
    windSpeedKmh: z.number(), windDirectionDegrees: z.number(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: forecastSwarmTrajectory(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
