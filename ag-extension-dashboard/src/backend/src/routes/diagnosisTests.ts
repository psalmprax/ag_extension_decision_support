/**
 * Testing photo diagnosis on labelled photos (services/diagnosisTests).
 *   GET    /diagnosis-tests             classes in the test set, their latest result, recent runs, thresholds
 *   POST   /diagnosis-tests/images      add a labelled photo (an upload id, crop, label)
 *   DELETE /diagnosis-tests/images/:id  remove one
 *   POST   /diagnosis-tests/runs        run diagnosis over the set (background)
 *   GET    /diagnosis-tests/runs/:id/mistakes   the photos a run got wrong
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { addTestImage, listClasses, removeTestImage, TestSetError } from '@/services/diagnosisTests/testSet';
import { latestRuns, runMistakes, startEvaluation, MAX_PHOTOS_PER_RUN } from '@/services/diagnosisTests/evaluate';
import { MIN_ACCURACY, MIN_SAMPLES } from '@/services/diagnosisTests/gate';

const router = Router();
const reviewers = authorize(['admin', 'regional_manager']);

type Principal = { userId: string; role: string; isDemo?: boolean };
const principalOf = (req: Request) => req.user as Principal;

function fail(res: Response, error: unknown, what: string) {
    if (error instanceof TestSetError) return res.status(error.status).json({ success: false, error: error.message });
    logger.error(`Diagnosis tests: ${what} failed:`, error);
    return safeError(res, 500, `Could not ${what}`);
}

router.get('/', reviewers, async (_req: Request, res: Response) => {
    try {
        const [classes, runs] = await Promise.all([listClasses(), latestRuns()]);
        return res.json({ success: true, data: { classes, runs, thresholds: { minSamples: MIN_SAMPLES, minAccuracy: MIN_ACCURACY, maxPhotosPerRun: MAX_PHOTOS_PER_RUN } } });
    } catch (error) { return fail(res, error, 'load the test set'); }
});

const imageSchema = z.object({
    uploadId: z.string().uuid(),
    crop: z.string().trim().min(2).max(80),
    label: z.string().trim().min(2).max(160),
    country: z.string().trim().max(100).optional(),
});

// Officers add photos they confirmed in the field; managers and admins add agronomist-labelled ones.
router.post('/images', authorize(['admin', 'regional_manager', 'extension_officer']), validate({ body: imageSchema }), async (req: Request, res: Response) => {
    try {
        return res.status(201).json({ success: true, data: await addTestImage(principalOf(req), req.body) });
    } catch (error) { return fail(res, error, 'add the photo'); }
});

router.delete('/images/:id', reviewers, async (req: Request, res: Response) => {
    try {
        const removed = await removeTestImage(req.params.id);
        return removed ? res.json({ success: true }) : res.status(404).json({ success: false, error: 'Photo not found' });
    } catch (error) { return fail(res, error, 'remove the photo'); }
});

router.post('/runs', reviewers, async (req: Request, res: Response) => {
    try {
        return res.status(202).json({ success: true, data: await startEvaluation(principalOf(req).userId) });
    } catch (error) { return fail(res, error, 'start the test'); }
});

router.get('/runs/:id/mistakes', reviewers, async (req: Request, res: Response) => {
    try {
        return res.json({ success: true, data: await runMistakes(req.params.id) });
    } catch (error) { return fail(res, error, 'load the mistakes'); }
});

export default router;
