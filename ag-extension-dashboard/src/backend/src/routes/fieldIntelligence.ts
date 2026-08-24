import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validationMiddleware';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { optimizeRoute, RouteStop } from '@/services/routeOptimizationService';
import { farmPlanService } from '@/services/farmPlanService';
import { officerGamificationService } from '@/services/officerGamificationService';
import { soilLabService } from '@/services/soilLabService';
import { weatherIndexService } from '@/services/weatherIndexService';
import { misExportService, MisDataset } from '@/services/misExportService';
import { adviceEfficacyService } from '@/services/adviceEfficacyService';

const router = Router();
type AuthedRequest = Request & { user?: { userId: string; role: string } };

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

// ── Route optimizer ──────────────────────────────────────────────────────────

router.get('/route-plan', async (req: AuthedRequest, res: Response) => {
    try {
        const maxStops = Math.min(parseInt((req.query.maxStops as string) || '10', 10) || 10, 20);
        const followups = await adviceEfficacyService.getFollowUpQueue(req.user!.userId);
        if (followups.length === 0) {
            return res.json({ success: true, data: { stops: [], totalKm: 0 } });
        }

        // Officer's start point: centroid of their farmers (or first located follow-up).
        const { rows: officerLoc } = await query<{ lat: number | null; lng: number | null }>(
            `SELECT AVG(f.location_lat) AS lat, AVG(f.location_lng) AS lng
             FROM farmers f WHERE f.assigned_officer_id = $1 AND f.location_lat IS NOT NULL`,
            [req.user!.userId]
        );

        const stops: RouteStop[] = followups
            .filter(f => f.lat !== null && f.lng !== null)
            .map(f => ({
                visitId: f.visitId,
                farmerName: f.farmerName,
                lat: f.lat!,
                lng: f.lng!,
                daysOverdue: f.daysOverdue,
                vitalScore: f.vitalScore ?? 50,
            }));

        if (stops.length === 0) return res.json({ success: true, data: { stops: [], totalKm: 0 } });
        const firstLocated = stops[0];
        const start = {
            lat: officerLoc[0]?.lat != null ? Number(officerLoc[0].lat) : firstLocated.lat,
            lng: officerLoc[0]?.lng != null ? Number(officerLoc[0].lng) : firstLocated.lng,
        };
        const plan = optimizeRoute(start, stops, { maxStops });
        return res.json({ success: true, data: plan });
    } catch (error) {
        logger.error('Route plan failed:', error);
        return safeError(res, 500, 'Failed to build route plan');
    }
});

// ── Farm plans ───────────────────────────────────────────────────────────────

router.post('/farm-plans/:cropCycleId/generate', async (req: AuthedRequest, res: Response) => {
    try {
        const result = await farmPlanService.generatePlan(req.params.cropCycleId);
        return res.json({ success: true, data: result });
    } catch (error) {
        if ((error as Error).message === 'CROP_CYCLE_NOT_FOUND') {
            return res.status(404).json({ success: false, error: 'Crop cycle not found' });
        }
        logger.error('Farm plan generation failed:', error);
        return safeError(res, 500, 'Failed to generate farm plan');
    }
});

router.get('/farm-plans/:cropCycleId', async (req: AuthedRequest, res: Response) => {
    try {
        const milestones = await farmPlanService.getPlan(req.params.cropCycleId);
        return res.json({ success: true, data: milestones });
    } catch (error) {
        logger.error('Farm plan load failed:', error);
        return safeError(res, 500, 'Failed to load farm plan');
    }
});

const milestoneStatusSchema = z.object({
    status: z.enum(['pending', 'done', 'missed']),
    notes: z.string().max(1000).optional(),
});

router.patch('/farm-plans/milestones/:milestoneId', validate({ body: milestoneStatusSchema }), async (req: AuthedRequest, res: Response) => {
    try {
        await farmPlanService.setMilestoneStatus(req.params.milestoneId, req.body.status, req.body.notes);
        return res.json({ success: true });
    } catch (error) {
        logger.error('Milestone update failed:', error);
        return safeError(res, 500, 'Failed to update milestone');
    }
});

// ── Gamification ─────────────────────────────────────────────────────────────

router.get('/leaderboard', async (_req: AuthedRequest, res: Response) => {
    try {
        const leaderboard = await officerGamificationService.getLeaderboard();
        return res.json({ success: true, data: leaderboard });
    } catch (error) {
        logger.error('Leaderboard failed:', error);
        return safeError(res, 500, 'Failed to load leaderboard');
    }
});

// ── Soil lab import ──────────────────────────────────────────────────────────

const soilLabImportSchema = z.object({
    csv: z.string().min(10).max(2_000_000),
});

router.post('/soil-lab/import', validate({ body: soilLabImportSchema }), async (req: AuthedRequest, res: Response) => {
    try {
        const rows = soilLabService.parseSoilLabCsv(req.body.csv);
        const result = await soilLabService.importRows(rows);
        return res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Soil lab import failed:', error);
        return res.status(400).json({ success: false, error: (error as Error).message });
    }
});

router.get('/soil-lab/farmer/:farmerId', async (req: AuthedRequest, res: Response) => {
    try {
        const results = await soilLabService.getResultsForFarmer(req.params.farmerId);
        return res.json({ success: true, data: results });
    } catch (error) {
        logger.error('Soil lab query failed:', error);
        return safeError(res, 500, 'Failed to load soil lab results');
    }
});

// ── Insurance weather index ──────────────────────────────────────────────────

router.get('/insurance/weather-index', async (req: AuthedRequest, res: Response) => {
    try {
        const district = typeof req.query.district === 'string' ? req.query.district : '';
        if (!district) return res.status(400).json({ success: false, error: 'district query param required' });
        const index = await weatherIndexService.computeDistrictIndex(district);
        if (!index) return res.status(404).json({ success: false, error: 'No geolocated farmers in district' });
        return res.json({ success: true, data: index, partnerIntegration: 'pending — see docs/specs/PHASE3-MARKETPLACE-CREDIT-CARBON.md' });
    } catch (error) {
        logger.error('Weather index failed:', error);
        return safeError(res, 500, 'Failed to compute weather index');
    }
});

// ── MIS exports (admin/regional only) ────────────────────────────────────────

router.get('/mis/export/:dataset', authorize(['admin', 'regional_manager']), async (req: AuthedRequest, res: Response) => {
    try {
        const dataset = req.params.dataset as MisDataset;
        const { csv, rowCount } = await misExportService.exportDataset(dataset);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="gpexts_${dataset}_mis_v${misExportService.version.replace(/\./g, '_')}.csv"`);
        return res.send(csv);
    } catch (error) {
        if ((error as Error).message === 'UNKNOWN_DATASET') {
            return res.status(404).json({ success: false, error: 'Unknown dataset. Use: farmers | visits | outcomes' });
        }
        logger.error('MIS export failed:', error);
        return safeError(res, 500, 'Export failed');
    }
});

export default router;
