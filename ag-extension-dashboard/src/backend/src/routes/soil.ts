import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { query } from '@/services/databaseService';
import { SoilGridsService } from '@/services/soilGridsService';
import { OpenMeteoSoilService } from '@/services/openMeteoSoilService';
import { soilLabService } from '@/services/soilLabService';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';


const router = Router();

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

const latLonSchema = z.object({
    lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
    lon: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
});

/**
 * GET /api/v1/soil/grid?lat=&lon=
 * Real regional baseline from ISRIC SoilGrids v2.0 (250m).
 */
router.get('/grid', validate({ query: latLonSchema }), async (req: Request, res: Response) => {
    try {
        const { lat, lon } = req.query as unknown as { lat: number; lon: number };
        const data = await SoilGridsService.fetchBaseline(lat, lon);
        return res.json({ success: true, data });
    } catch (error) {
        logger.error('SoilGrids fetch failed:', error);
        return safeError(res, 502, error instanceof Error ? error.message : 'SoilGrids fetch failed');
    }
});

/**
 * GET /api/v1/soil/moisture?lat=&lon=
 * Modeled soil moisture/temperature from Open-Meteo (ERA5 assimilation).
 */
router.get('/moisture', validate({ query: latLonSchema }), async (req: Request, res: Response) => {
    try {
        const { lat, lon } = req.query as unknown as { lat: number; lon: number };
        const data = await OpenMeteoSoilService.fetchSnapshot(lat, lon);
        return res.json({ success: true, data });
    } catch (error) {
        logger.error('Soil moisture fetch failed:', error);
        return safeError(res, 502, error instanceof Error ? error.message : 'Soil moisture fetch failed');
    }
});

async function assertSoilFarmerAccess(user: AuthRequest['user'], farmerId: string): Promise<void> {
    if (user?.role === 'farmer') {
        const { rows } = await query<{ id: string }>(`SELECT id FROM farmers WHERE id = $1 AND user_id = $2`, [farmerId, user.userId]);
        if (rows.length === 0) throw Object.assign(new Error('Not authorized for this farmer'), { statusCode: 403 });
    } else if (user?.role === 'extension_officer') {
        const { rows } = await query<{ id: string }>(`SELECT id FROM farmers WHERE id = $1 AND assigned_officer_id = $2`, [farmerId, user.userId]);
        if (rows.length === 0) throw Object.assign(new Error('Farmer not in your cohort'), { statusCode: 403 });
    }
}
async function getFarmerLocation(farmerId: string): Promise<{ lat: number | null; lon: number | null }> {
    const { rows } = await query<{ location_lat: string | null; location_lng: string | null }>(
        `SELECT location_lat, location_lng FROM farmers WHERE id = $1`, [farmerId]
    );
    return {
        lat: rows[0]?.location_lat ? Number(rows[0].location_lat) : null,
        lon: rows[0]?.location_lng ? Number(rows[0].location_lng) : null,
    };
}
async function getSoilComplements(lat: number | null, lon: number | null): Promise<{ baseline: unknown; moisture: unknown }> {
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return { baseline: null, moisture: null };
    const [b, m] = await Promise.allSettled([
        SoilGridsService.fetchBaseline(lat, lon),
        OpenMeteoSoilService.fetchSnapshot(lat, lon),
    ]);
    return {
        baseline: b.status === 'fulfilled' ? b.value : { error: b.reason instanceof Error ? b.reason.message : String(b.reason), dataStatus: 'unavailable' },
        moisture: m.status === 'fulfilled' ? m.value : { error: m.reason instanceof Error ? m.reason.message : String(m.reason), dataStatus: 'unavailable' },
    };
}

/**
 * GET /api/v1/soil/farmer/:farmerId
 * Aggregated soil profile: lab history (real) + SoilGrids baseline (regional, if farmer has lat/lon)
 * + live moisture (modeled, if farmer has lat/lon). Each section carries its own provenance.
 */
router.get('/farmer/:farmerId', async (req: AuthRequest, res: Response) => {
    try {
        const { farmerId } = req.params;
        if (!farmerId) return res.status(400).json({ success: false, error: 'farmerId required' });
        await assertSoilFarmerAccess(req.user, farmerId);
        const labResults = await soilLabService.getResultsForFarmer(farmerId);
        const { lat, lon } = await getFarmerLocation(farmerId);
        const { baseline, moisture } = await getSoilComplements(lat, lon);
        return res.json({
            success: true,
            data: {
                labResults,
                baseline,
                moisture,
                location: lat !== null && lon !== null ? { lat, lon } : null,
            },
        });
    } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode) return res.status(statusCode).json({ success: false, error: (error as Error).message });
        logger.error('Farmer soil profile failed:', error);
        return safeError(res, 500, error instanceof Error ? error.message : 'Failed to load soil profile');
    }
});

export default router;
