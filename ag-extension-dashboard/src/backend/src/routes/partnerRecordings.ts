/**
 * Content partners and their audio libraries (services/partners).
 *   GET    /content-partners                       partners this person may use
 *   POST   /content-partners                       add a partner (administrator)
 *   GET    /content-partners/organisations         organisations that can be granted access (administrator)
 *   PUT    /content-partners/:id/grants/:tenantId  let an organisation use it (administrator)
 *   DELETE /content-partners/:id/grants/:tenantId  stop that
 *   GET    /partner-recordings                     the library: drafts for reviewers, approved for everyone
 *   GET    /partner-recordings/for-farmer/:farmerId  approved recordings that fit a farmer
 *   POST   /partner-recordings/:id/review          approve (with the checked transcript) or reject
 *   POST   /partner-recordings/:id/send            send to farmers this person serves
 *   GET    /partner-recordings/:id/audio?sig=      the approved audio, for a phone (signed link, no sign-in)
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { readStoredUpload } from '@/services/uploadService';
import { ArchiveError } from '@/services/archives/zipEntries';
import { createPartner, listOrganisations, listPartners, PartnerError, setGrant, type Principal } from '@/services/partners/partners';
import { MANIFEST_COLUMNS } from '@/services/partners/recordingImport';
import { MAX_ARCHIVE_MB } from './imports';
import {
    isValidRecordingSignature, listRecordings, matchesForFarmer, recordingFile, reviewRecording, sendRecording, type RecordingRow,
} from '@/services/partners/recordingLibrary';

export const partnersRouter = Router();
export const recordingsRouter = Router();

const staff = authorize(['admin', 'regional_manager', 'extension_officer']);
const admin = authorize(['admin']);
const principalOf = (req: Request) => req.user as Principal;
const uuid = z.guid();

function fail(res: Response, error: unknown, what: string) {
    if (error instanceof PartnerError || error instanceof ArchiveError) {
        return res.status(error.status).json({ success: false, error: error.message });
    }
    logger.error(`Partner library: ${what} failed:`, error);
    return safeError(res, 500, `Could not ${what}`);
}

const recordingDto = (row: RecordingRow) => ({
    id: row.id, partnerId: row.partner_id, partner: row.partner_name, title: row.title, speaker: row.speaker,
    language: row.language, crops: row.crops, regions: row.regions, topic: row.topic, licence: row.licence,
    licenceExpiresAt: row.licence_expires_at, transcript: row.transcript, transcriptStatus: row.transcript_status,
    reviewStatus: row.review_status, deliveries: Number(row.deliveries), createdAt: row.created_at,
    url: `/api/v1/upload/file/${encodeURIComponent(row.storage_key)}`,
});

// ── Partners ──────────────────────────────────────────────────────────────

partnersRouter.get('/', staff, async (req: Request, res: Response) => {
    try {
        const partners = (await listPartners(principalOf(req))).map(p => ({
            id: p.id, name: p.name, website: p.website, contactEmail: p.contact_email, notes: p.notes,
            recordings: Number(p.recordings), approved: Number(p.approved), organisations: p.tenants ?? [], createdAt: p.created_at,
        }));
        return res.json({ success: true, data: { partners, manifestColumns: MANIFEST_COLUMNS, maxArchiveMb: MAX_ARCHIVE_MB } });
    } catch (error) { return fail(res, error, 'load partners'); }
});

partnersRouter.get('/organisations', admin, async (_req: Request, res: Response) => {
    try { return res.json({ success: true, data: { organisations: await listOrganisations() } }); }
    catch (error) { return fail(res, error, 'load organisations'); }
});

const partnerSchema = z.object({
    name: z.string().trim().min(2).max(200),
    website: z.string().trim().url().max(300).optional().nullable(),
    contactEmail: z.string().trim().email().max(255).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
});

partnersRouter.post('/', admin, validate({ body: partnerSchema }), async (req: Request, res: Response) => {
    try { return res.status(201).json({ success: true, data: await createPartner(principalOf(req).userId, req.body) }); }
    catch (error) { return fail(res, error, 'add the partner'); }
});

const grantParams = z.object({ id: uuid, tenantId: uuid });
for (const [method, granted] of [['put', true], ['delete', false]] as const) {
    partnersRouter[method]('/:id/grants/:tenantId', admin, validate({ params: grantParams }), async (req: Request, res: Response) => {
        try {
            await setGrant(principalOf(req).userId, req.params.id, req.params.tenantId, granted);
            return res.json({ success: true });
        } catch (error) { return fail(res, error, 'change who may use the library'); }
    });
}

// ── Recordings ────────────────────────────────────────────────────────────

recordingsRouter.get('/:id/audio', async (req: Request, res: Response) => {
    if (!uuid.safeParse(req.params.id).success || !isValidRecordingSignature(req.params.id, req.query.sig)) return res.status(403).end();
    try {
        const file = await recordingFile(req.params.id);
        if (!file) return res.status(404).end();
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(await readStoredUpload(file.storage_key));
    } catch (error) {
        logger.error('Partner recording could not be served:', error);
        return res.status(500).end();
    }
});

const listQuery = z.object({
    status: z.enum(['pending_review', 'approved', 'rejected']).optional(),
    language: z.string().trim().max(10).optional(),
    crop: z.string().trim().max(60).optional(),
    partnerId: uuid.optional(),
});

recordingsRouter.get('/', staff, validate({ query: listQuery }), async (req: Request, res: Response) => {
    try {
        const rows = await listRecordings(principalOf(req), req.query as z.infer<typeof listQuery>);
        return res.json({ success: true, data: { recordings: rows.map(recordingDto) } });
    } catch (error) { return fail(res, error, 'load recordings'); }
});

recordingsRouter.get('/for-farmer/:farmerId', staff, validate({ params: z.object({ farmerId: uuid }) }), async (req: Request, res: Response) => {
    try {
        const rows = await matchesForFarmer(principalOf(req), req.params.farmerId);
        return res.json({ success: true, data: { recordings: rows.map(recordingDto) } });
    } catch (error) { return fail(res, error, 'find recordings for this farmer'); }
});

const reviewSchema = z.object({ decision: z.enum(['approve', 'reject']), transcript: z.string().max(20000).optional() });

recordingsRouter.post('/:id/review', staff, validate({ params: z.object({ id: uuid }), body: reviewSchema }), async (req: Request, res: Response) => {
    try { return res.json({ success: true, data: recordingDto(await reviewRecording(principalOf(req), req.params.id, req.body)) }); }
    catch (error) { return fail(res, error, 'save the review'); }
});

const sendSchema = z.object({ farmerIds: z.array(uuid).min(1).max(500) });

recordingsRouter.post('/:id/send', staff, validate({ params: z.object({ id: uuid }), body: sendSchema }), async (req: Request, res: Response) => {
    try { return res.json({ success: true, data: await sendRecording(principalOf(req), req.params.id, req.body.farmerIds) }); }
    catch (error) { return fail(res, error, 'send the recording'); }
});
