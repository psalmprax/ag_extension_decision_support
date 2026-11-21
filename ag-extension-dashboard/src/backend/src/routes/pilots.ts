/**
 * Pilots (services/pilots): set one up, start it (random split), ask for harvests, follow
 * the results, export farmer-level data without names for an evaluator.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { askHarvest, closePilot, createPilot, getPilot, listPilots, PilotError, startPilot, type PilotPrincipal } from '@/services/pilots/pilots';
import { MIN_PER_GROUP, pilotExportCsv, pilotResults } from '@/services/pilots/results';

const router = Router();
router.use(authorize(['admin', 'regional_manager']));

const principalOf = (req: Request) => req.user as PilotPrincipal;

function fail(res: Response, error: unknown, what: string) {
    if (error instanceof PilotError) return res.status(error.status).json({ success: false, error: error.message });
    logger.error(`Pilots: ${what} failed:`, error);
    return safeError(res, 500, `Could not ${what}`);
}

router.get('/', async (req: Request, res: Response) => {
    try { return res.json({ success: true, data: await listPilots(principalOf(req)) }); } catch (error) { return fail(res, error, 'load pilots'); }
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pilotSchema = z.object({
    name: z.string().trim().min(3).max(200),
    region: z.string().trim().min(1).max(100),
    country: z.string().trim().max(100).optional(),
    crop: z.string().trim().min(2).max(80),
    seasonStart: date,
    seasonEnd: date,
    comparisonShare: z.number().min(0.2).max(0.8).optional(),
    bagKg: z.number().positive().max(200).optional(),
});

router.post('/', validate({ body: pilotSchema }), async (req: Request, res: Response) => {
    try { return res.status(201).json({ success: true, data: await createPilot(principalOf(req), req.body) }); } catch (error) { return fail(res, error, 'create the pilot'); }
});

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const pilot = await getPilot(principalOf(req), req.params.id);
        return res.json({ success: true, data: { pilot, results: await pilotResults(pilot.id), minPerGroup: MIN_PER_GROUP } });
    } catch (error) { return fail(res, error, 'load the pilot'); }
});

router.post('/:id/start', async (req: Request, res: Response) => {
    try { return res.json({ success: true, data: await startPilot(principalOf(req), req.params.id) }); } catch (error) { return fail(res, error, 'start the pilot'); }
});

router.post('/:id/close', async (req: Request, res: Response) => {
    try { await closePilot(principalOf(req), req.params.id); return res.json({ success: true }); } catch (error) { return fail(res, error, 'close the pilot'); }
});

router.post('/:id/ask-harvest', validate({ body: z.object({ which: z.enum(['baseline', 'endline']) }) }), async (req: Request, res: Response) => {
    try { return res.json({ success: true, data: await askHarvest(principalOf(req), req.params.id, req.body.which) }); } catch (error) { return fail(res, error, 'ask for harvests'); }
});

router.get('/:id/export.csv', async (req: Request, res: Response) => {
    try {
        const pilot = await getPilot(principalOf(req), req.params.id);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="pilot-${pilot.id.slice(0, 8)}.csv"`);
        return res.send(await pilotExportCsv(pilot.id));
    } catch (error) { return fail(res, error, 'export the pilot'); }
});

export default router;
