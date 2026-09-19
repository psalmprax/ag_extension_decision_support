import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { outbreakService } from '@/services/outbreakService';

const router = Router();

type AuthedRequest = Request & { user?: { userId: string; role: string } };

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * GET /api/outbreaks — k-anonymized disease clusters for the heatmap.
 * Optional bbox=minLat,maxLat,minLng,maxLng to scope to the visible map area.
 * Centroids receive differential privacy perturbation (IR-004).
 */
router.get('/', async (req: AuthedRequest, res: Response) => {
    try {
        const days = Math.min(parseInt((req.query.days as string) || '14', 10) || 14, 90);
        let bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | undefined;

        if (typeof req.query.bbox === 'string') {
            const parts = req.query.bbox.split(',').map(Number);
            if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
                bbox = { minLat: parts[0], maxLat: parts[1], minLng: parts[2], maxLng: parts[3] };
            }
        }

        const clusters = await outbreakService.getClusters({ days, bbox });
        const threshold = 5;
        return res.json({
            success: true,
            data: clusters.map(c => ({ ...c, alert: c.caseCount >= threshold })),
            kAnonymityFloor: 3,
        });
    } catch (error) {
        logger.error('Failed to load outbreak clusters:', error);
        return safeError(res, 500, 'Failed to load outbreak clusters');
    }
});

/**
 * POST /api/outbreaks/dispersal-projection — Atmospheric spore & pest dispersal cone projection (CE-002).
 * Integrates wind speed, direction, ambient temperature, and relative humidity to forecast
 * downwind plume trajectory and microclimate viability.
 */
router.post('/dispersal-projection', async (req: AuthedRequest, res: Response) => {
    try {
        const { centroid, windSpeedKmH, windBearingDeg, relativeHumidity, temperatureC, crop, diseaseLabel, timeHorizonHours } = req.body;

        if (!centroid || typeof centroid.lat !== 'number' || typeof centroid.lng !== 'number') {
            return res.status(400).json({ success: false, error: 'Valid centroid with numeric lat and lng is required' });
        }
        if (centroid.lat < -90 || centroid.lat > 90 || centroid.lng < -180 || centroid.lng > 180) {
            return res.status(400).json({ success: false, error: 'Centroid lat must be between -90 and 90, lng between -180 and 180' });
        }
        if (typeof windSpeedKmH !== 'number' || windSpeedKmH < 0) {
            return res.status(400).json({ success: false, error: 'windSpeedKmH must be a non-negative number' });
        }
        if (typeof windBearingDeg !== 'number' || windBearingDeg < 0 || windBearingDeg > 360) {
            return res.status(400).json({ success: false, error: 'windBearingDeg must be a number between 0 and 360' });
        }
        if (typeof relativeHumidity !== 'number' || relativeHumidity < 0 || relativeHumidity > 100) {
            return res.status(400).json({ success: false, error: 'relativeHumidity must be a percentage between 0 and 100' });
        }
        if (typeof temperatureC !== 'number' || temperatureC < -50 || temperatureC > 60) {
            return res.status(400).json({ success: false, error: 'temperatureC must be a valid Celsius temperature' });
        }

        const projection = outbreakService.projectAtmosphericDispersalCone({
            centroid,
            windSpeedKmH,
            windBearingDeg,
            relativeHumidity,
            temperatureC,
            crop,
            diseaseLabel,
            timeHorizonHours: typeof timeHorizonHours === 'number' ? timeHorizonHours : undefined,
        });

        return res.json({
            success: true,
            data: projection,
        });
    } catch (error) {
        logger.error('Failed to calculate atmospheric dispersal projection:', error);
        return safeError(res, 500, 'Failed to calculate atmospheric dispersal projection');
    }
});

export default router;
