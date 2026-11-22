/**
 * The voice library (services/voice/voiceClips) and voice advisories (advisoryCalls).
 *   GET    /voice-clips/:id/audio?sig=   the recording, for the voice provider (signed link, no sign-in)
 *   GET    /voice-clips                  recordings, the prompts to record, whether calling is set up
 *   POST   /voice-clips                  save a recording for a message and language
 *   DELETE /voice-clips/:id
 *   POST   /voice-clips/:id/call         call a pilot's service group, or chosen farmers, and play it
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { readStoredUpload } from '@/services/uploadService';
import { canSeeFarmer } from '@/services/access/farmerScope';
import { getPilot } from '@/services/pilots/pilots';
import { clipFile, deleteClip, isValidClipSignature, listClips, mayChangeClip, PROMPTS, saveClip, VoiceClipError } from '@/services/voice/voiceClips';
import { callFarmers, callingConfigured, DAILY_CALL_LIMIT } from '@/services/voice/advisoryCalls';

const router = Router();
const staff = authorize(['admin', 'regional_manager']);
type Principal = { userId: string; role: string; isDemo?: boolean };
const principalOf = (req: Request) => req.user as Principal;

function fail(res: Response, error: unknown, what: string) {
    const status = (error as { status?: number }).status;
    if (error instanceof VoiceClipError || (status && status < 500)) {
        return res.status(status ?? 400).json({ success: false, error: (error as Error).message });
    }
    logger.error(`Voice clips: ${what} failed:`, error);
    return safeError(res, 500, `Could not ${what}`);
}

router.get('/:id/audio', async (req: Request, res: Response) => {
    if (!isValidClipSignature(req.params.id, req.query.sig)) return res.status(403).end();
    try {
        const file = await clipFile(req.params.id);
        if (!file) return res.status(404).end();
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(await readStoredUpload(file.storage_key));
    } catch (error) {
        logger.error('Voice clip could not be served:', error);
        return res.status(500).end();
    }
});

router.get('/', staff, async (req: Request, res: Response) => {
    try {
        const clips = (await listClips()).map(clip => ({
            id: clip.id, key: clip.key, language: clip.language, title: clip.title, transcript: clip.transcript,
            url: `/api/v1/upload/file/${encodeURIComponent(clip.storage_key)}`, createdAt: clip.created_at,
            canChange: mayChangeClip(clip, principalOf(req)),
        }));
        return res.json({ success: true, data: { clips, prompts: PROMPTS, callingConfigured: callingConfigured(), dailyCallLimit: DAILY_CALL_LIMIT } });
    } catch (error) { return fail(res, error, 'load recordings'); }
});

const clipSchema = z.object({
    key: z.string().trim().min(2).max(80),
    language: z.string().trim().min(2).max(10),
    title: z.string().trim().min(2).max(200),
    transcript: z.string().max(4000).optional(),
    uploadId: z.string().uuid(),
});

router.post('/', staff, validate({ body: clipSchema }), async (req: Request, res: Response) => {
    try { return res.status(201).json({ success: true, data: await saveClip(principalOf(req), req.body) }); } catch (error) { return fail(res, error, 'save the recording'); }
});

router.delete('/:id', staff, async (req: Request, res: Response) => {
    try {
        return (await deleteClip(req.params.id, principalOf(req))) ? res.json({ success: true }) : res.status(404).json({ success: false, error: 'Recording not found' });
    } catch (error) { return fail(res, error, 'delete the recording'); }
});

const callSchema = z.object({ pilotId: z.string().uuid().optional(), farmerIds: z.array(z.string().uuid()).max(500).optional() });

router.post('/:id/call', staff, validate({ body: callSchema }), async (req: Request, res: Response) => {
    try {
        const principal = principalOf(req);
        const { pilotId, farmerIds } = req.body as z.infer<typeof callSchema>;
        if (pilotId) await getPilot(principal, pilotId);
        // A manager calls only farmers in their region.
        const allowed = farmerIds ? (await Promise.all(farmerIds.map(async id => ((await canSeeFarmer(principal, id)) ? id : null)))).filter((id): id is string => Boolean(id)) : undefined;
        return res.json({ success: true, data: await callFarmers(principal.userId, req.params.id, { pilotId, farmerIds: allowed }) });
    } catch (error) { return fail(res, error, 'place the calls'); }
});

export default router;
