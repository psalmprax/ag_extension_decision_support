/**
 * Runs photo diagnosis over the labelled test set and records, per crop and label, how
 * many photos it got right. The run happens in the background (each photo is one AI
 * vision call, counted like any other), one run at a time.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { readStoredUpload } from '@/services/uploadService';
import { plantDiseaseService } from '@/services/plantDiseaseService';
import { matchesLabel, topPrediction } from './matching';
import { TestSetError } from './testSet';

/** The most photos one run sends to the AI, to keep a run's cost bounded. */
export const MAX_PHOTOS_PER_RUN = Number(process.env.DIAGNOSIS_TEST_MAX_PHOTOS || 400);

interface TestPhoto { id: string; crop: string; label: string; storage_key: string }

async function photosToTest(): Promise<TestPhoto[]> {
    const { rows } = await query<TestPhoto>(
        `SELECT t.id, t.crop, t.label, u.storage_key
           FROM diagnosis_test_images t JOIN upload_records u ON u.id = t.upload_id
          WHERE u.status = 'active'
          ORDER BY t.created_at DESC LIMIT $1`,
        [MAX_PHOTOS_PER_RUN],
    );
    return rows;
}

/** Test one photo; null when the photo could not be read (left out of the counts). */
export async function testPhoto(photo: TestPhoto): Promise<{ predicted: string; confidence: number | null; correct: boolean } | null> {
    let buffer: Buffer;
    try {
        buffer = await readStoredUpload(photo.storage_key);
    } catch (error) {
        logger.warn(`Diagnosis test photo ${photo.id} could not be read:`, error);
        return null;
    }
    const analysis = await plantDiseaseService.analyzeImage(buffer, photo.crop);
    const top = topPrediction(analysis);
    return { predicted: top.name.slice(0, 200), confidence: top.confidence, correct: matchesLabel(top.name, photo.label) };
}

/** Replace the per-class results with this run's. */
async function recordClassStatus(runId: string): Promise<void> {
    await query('DELETE FROM diagnosis_class_status');
    await query(
        `INSERT INTO diagnosis_class_status (crop, label, samples, correct, run_id)
         SELECT t.crop, t.label, COUNT(*), COUNT(*) FILTER (WHERE r.correct), $1
           FROM diagnosis_eval_results r JOIN diagnosis_test_images t ON t.id = r.image_id
          WHERE r.run_id = $1
          GROUP BY t.crop, t.label`,
        [runId],
    );
}

export async function runEvaluation(runId: string, photos: TestPhoto[]): Promise<void> {
    try {
        for (const photo of photos) {
            const result = await testPhoto(photo);
            if (result) {
                await query(
                    `INSERT INTO diagnosis_eval_results (run_id, image_id, predicted, confidence, correct)
                     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                    [runId, photo.id, result.predicted, result.confidence, result.correct],
                );
            }
            await query(
                'UPDATE diagnosis_eval_runs SET done = done + 1, correct = correct + $2 WHERE id = $1',
                [runId, result?.correct ? 1 : 0],
            );
        }
        await recordClassStatus(runId);
        await query(`UPDATE diagnosis_eval_runs SET status = 'finished', finished_at = NOW() WHERE id = $1`, [runId]);
    } catch (error) {
        logger.error(`Diagnosis test run ${runId} failed:`, error);
        await query(`UPDATE diagnosis_eval_runs SET status = 'failed', finished_at = NOW() WHERE id = $1`, [runId]);
    }
}

/** Start a run in the background. Refused while another run is going or the set is empty. */
export async function startEvaluation(startedBy: string): Promise<{ id: string; total: number }> {
    const running = await query(
        `SELECT 1 FROM diagnosis_eval_runs WHERE status = 'running' AND started_at > NOW() - INTERVAL '6 hours' LIMIT 1`,
    );
    if (running.rows.length) throw new TestSetError('A test run is already going. Wait for it to finish.', 409);
    const photos = await photosToTest();
    if (photos.length === 0) throw new TestSetError('Add labelled photos before running a test.');
    const { rows } = await query<{ id: string }>(
        `INSERT INTO diagnosis_eval_runs (started_by, total, model) VALUES ($1, $2, $3) RETURNING id`,
        [startedBy, photos.length, process.env.VISION_MODEL || null],
    );
    const runId = rows[0].id;
    setImmediate(() => { void runEvaluation(runId, photos); });
    return { id: runId, total: photos.length };
}

export interface RunSummary {
    id: string; status: string; total: number; done: number; correct: number;
    startedAt: string; finishedAt: string | null;
}

export async function latestRuns(limit = 5): Promise<RunSummary[]> {
    const { rows } = await query<{ id: string; status: string; total: number; done: number; correct: number; started_at: Date; finished_at: Date | null }>(
        `SELECT id, status, total, done, correct, started_at, finished_at FROM diagnosis_eval_runs ORDER BY started_at DESC LIMIT $1`,
        [limit],
    );
    return rows.map(row => ({
        id: row.id, status: row.status, total: row.total, done: row.done, correct: row.correct,
        startedAt: new Date(row.started_at).toISOString(), finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    }));
}

/** The photos a run got wrong, to show the team where it fails. */
export async function runMistakes(runId: string, limit = 100) {
    const { rows } = await query<{ image_id: string; crop: string; label: string; predicted: string | null; storage_key: string }>(
        `SELECT r.image_id, t.crop, t.label, r.predicted, u.storage_key
           FROM diagnosis_eval_results r
           JOIN diagnosis_test_images t ON t.id = r.image_id
           JOIN upload_records u ON u.id = t.upload_id
          WHERE r.run_id = $1 AND NOT r.correct
          ORDER BY t.crop, t.label LIMIT $2`,
        [runId, limit],
    );
    return rows.map(row => ({
        imageId: row.image_id, crop: row.crop, label: row.label, predicted: row.predicted,
        url: `/api/v1/upload/file/${encodeURIComponent(row.storage_key)}`,
    }));
}
