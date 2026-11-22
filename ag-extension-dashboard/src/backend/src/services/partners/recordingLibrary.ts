/**
 * The partner audio library as staff use it: listing what their organisation may use,
 * reviewing transcripts, matching recordings to a farmer, and sending them.
 *
 * - A recording grounds advice only once a reviewer (an administrator or a regional
 *   manager) has checked its transcript; approval makes it a knowledge article credited
 *   to the partner and the speaker.
 * - It is matched to a farmer by language, crop and region, never by guesswork about
 *   the farmer.
 * - Sending posts it into the farmer's thread (and so to their SMS or WhatsApp), with
 *   the audio attached, and logs who sent it to whom.
 */
import { createHmac } from 'crypto';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { canSeeFarmer } from '@/services/access/farmerScope';
import { farmerThreadFor } from '@/services/chat/channelThread';
import { postOfficerReply } from '@/services/chat/threadPost';
import { linkAttachments } from '@/services/uploadAttachments';
import { VectorService } from '@/services/vectorService';
import { PartnerError, partnerScope, type Principal } from './partners';
import { safeEqual } from '@/utils/safeEqual';

export interface RecordingRow {
    id: string;
    partner_id: string;
    partner_name: string;
    title: string;
    speaker: string;
    language: string;
    crops: string[];
    regions: string[];
    topic: string | null;
    licence: string;
    licence_expires_at: string | null;
    transcript: string | null;
    transcript_status: string;
    review_status: string;
    knowledge_article_id: string | null;
    created_at: string;
    deliveries: string;
    storage_key: string;
}

export interface RecordingFilters { status?: string; language?: string; crop?: string; partnerId?: string }

const REVIEWERS = new Set(['admin', 'regional_manager']);
const STILL_LICENSED = '(r.licence_expires_at IS NULL OR r.licence_expires_at > NOW())';

const signature = (id: string) => createHmac('sha256', config.jwt.secret).update(`partner-recording:${id}`).digest('hex').slice(0, 32);

export function isValidRecordingSignature(id: string, sig: unknown): boolean {
    return safeEqual(sig, signature(id));
}

/** A link a phone can play without signing in (sent over SMS or WhatsApp). */
export function recordingUrl(id: string): string {
    const base = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/$/, '');
    return `${base}/api/v1/partner-recordings/${id}/audio?sig=${signature(id)}`;
}

const SELECT = `
    SELECT r.id, r.partner_id, p.name AS partner_name, r.title, r.speaker, r.language, r.crops, r.regions, r.topic,
           r.licence, r.licence_expires_at, r.transcript, r.transcript_status, r.review_status, r.knowledge_article_id,
           r.created_at, (SELECT COUNT(*) FROM recording_deliveries d WHERE d.recording_id = r.id)::text AS deliveries,
           (SELECT u.storage_key FROM upload_records u WHERE u.id = r.upload_id) AS storage_key
      FROM partner_recordings r JOIN content_partners p ON p.id = r.partner_id`;

export async function listRecordings(principal: Principal, filters: RecordingFilters): Promise<RecordingRow[]> {
    const scope = await partnerScope(principal, 1);
    const params: unknown[] = [...scope.params];
    const where = [scope.sql];
    const add = (sql: (n: number) => string, value: unknown) => { params.push(value); where.push(sql(params.length)); };
    // Only reviewers see drafts; everyone else sees what has been approved and is still licensed.
    if (!REVIEWERS.has(principal.role)) where.push(`r.review_status = 'approved' AND ${STILL_LICENSED}`);
    else if (filters.status) add(n => `r.review_status = $${n}`, filters.status);
    if (filters.language) add(n => `left(r.language, 2) = left($${n}, 2)`, filters.language.toLowerCase());
    if (filters.crop) add(n => `EXISTS (SELECT 1 FROM unnest(r.crops) c WHERE lower(c) = lower($${n}))`, filters.crop);
    if (filters.partnerId) add(n => `r.partner_id = $${n}`, filters.partnerId);
    const { rows } = await query<RecordingRow>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 500`, params);
    return rows;
}

async function recordingFor(principal: Principal, id: string): Promise<RecordingRow> {
    const scope = await partnerScope(principal, 2);
    const { rows } = await query<RecordingRow>(`${SELECT} WHERE r.id = $1 AND ${scope.sql}`, [id, ...scope.params]);
    if (!rows[0]) throw new PartnerError('Recording not found', 404);
    return rows[0];
}

/** Turn an approved recording into a knowledge article that can ground answers. */
async function publishArticle(recording: RecordingRow, transcript: string): Promise<string> {
    const tags = ['partner_recording', `lang:${recording.language}`, `partner:${recording.partner_name}`, ...(recording.topic ? [recording.topic] : [])];
    const source = `${recording.partner_name} · ${recording.speaker}`.slice(0, 255);
    const { rows } = await query<{ id: string }>(
        `INSERT INTO knowledge_articles (id, title, content, content_type, summary, category, tags, crops, regions, source, source_url)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, 'audio_transcript', left($3, 300), $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, summary = EXCLUDED.summary, updated_at = NOW()
         RETURNING id`,
        [recording.knowledge_article_id, recording.title, transcript, recording.topic ?? 'Partner recording', tags,
            recording.crops, recording.regions, source, recordingUrl(recording.id)],
    );
    const articleId = rows[0].id;
    try {
        await VectorService.upsertDocument(articleId, transcript, {
            title: recording.title, category: recording.topic ?? 'Partner recording', tags, crops: recording.crops,
            regions: recording.regions, source, sourceUrl: recordingUrl(recording.id), contentType: 'audio_transcript',
        });
    } catch (error) {
        // Without an embedding provider the article is still saved; the boot backfill indexes it later.
        logger.warn(`Recording ${recording.id} approved; its search index waits for an embedding provider:`, (error as Error).message);
    }
    return articleId;
}

export interface ReviewInput { decision: 'approve' | 'reject'; transcript?: string }

export async function reviewRecording(principal: Principal, id: string, input: ReviewInput): Promise<RecordingRow> {
    if (!REVIEWERS.has(principal.role)) throw new PartnerError('Only an administrator or a regional manager reviews recordings', 403);
    const recording = await recordingFor(principal, id);
    if (input.decision === 'reject') {
        await query(`UPDATE partner_recordings SET review_status = 'rejected', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1`, [id, principal.userId]);
        if (recording.knowledge_article_id) await query('DELETE FROM knowledge_articles WHERE id = $1', [recording.knowledge_article_id]);
        return recordingFor(principal, id);
    }
    const transcript = (input.transcript ?? recording.transcript ?? '').trim();
    if (transcript.length < 20) throw new PartnerError('Check and complete the transcript before approving: it is what the assistant reads.');
    const articleId = await publishArticle(recording, transcript);
    await query(
        `UPDATE partner_recordings SET transcript = $2, transcript_status = 'transcribed', review_status = 'approved',
                reviewed_by = $3, reviewed_at = NOW(), knowledge_article_id = $4
          WHERE id = $1`,
        [id, transcript, principal.userId, articleId],
    );
    return recordingFor(principal, id);
}

/** Approved, still-licensed recordings that fit one farmer: their language first, then crop and region. */
export async function matchesForFarmer(principal: Principal, farmerId: string): Promise<RecordingRow[]> {
    if (!(await canSeeFarmer(principal, farmerId))) throw new PartnerError('Farmer not found', 404);
    const { rows: farmers } = await query<{ language: string | null; crops: string[] | null; region: string | null; tenant_id: string | null }>(
        'SELECT language_preference AS language, crops, region, tenant_id FROM farmers WHERE id = $1', [farmerId]);
    const farmer = farmers[0];
    if (!farmer) throw new PartnerError('Farmer not found', 404);
    const { rows } = await query<RecordingRow>(
        `${SELECT}
          WHERE r.review_status = 'approved' AND ${STILL_LICENSED}
            AND EXISTS (SELECT 1 FROM content_partner_grants g WHERE g.partner_id = r.partner_id AND g.tenant_id = $1)
            AND left(r.language, 2) = left($2, 2)
            AND (cardinality(r.crops) = 0 OR EXISTS (SELECT 1 FROM unnest(r.crops) c WHERE lower(c) = ANY(SELECT lower(x) FROM unnest($3::text[]) x)))
            AND (cardinality(r.regions) = 0 OR $4 = ANY(r.regions))
          ORDER BY cardinality(r.crops) DESC, r.created_at DESC
          LIMIT 20`,
        [farmer.tenant_id, farmer.language || 'en', farmer.crops ?? [], farmer.region],
    );
    return rows;
}

/**
 * Send an approved recording to farmers this person serves, as a message in each farmer's
 * thread with the audio attached. Returns who received it and who was skipped.
 */
export async function sendRecording(principal: Principal, id: string, farmerIds: string[]): Promise<{ sent: number; skipped: number }> {
    const recording = await recordingFor(principal, id);
    if (recording.review_status !== 'approved') throw new PartnerError('Only reviewed and approved recordings can be sent');
    if (recording.licence_expires_at && new Date(recording.licence_expires_at) <= new Date()) throw new PartnerError('This recording’s licence has expired');
    const { rows: uploads } = await query<{ upload_id: string }>('SELECT upload_id FROM partner_recordings WHERE id = $1', [id]);
    let sent = 0;
    for (const farmerId of Array.from(new Set(farmerIds)).slice(0, 500)) {
        if (!(await canSeeFarmer(principal, farmerId))) continue;
        const conversationId = await farmerThreadFor(farmerId);
        const message = await postOfficerReply(conversationId,
            `Listen: ${recording.title} (${recording.speaker}, ${recording.partner_name}). ${recordingUrl(recording.id)}`);
        if (!message) continue;
        await linkAttachments('chat', message.id, [uploads[0].upload_id]);
        await query(`INSERT INTO recording_deliveries (recording_id, farmer_id, channel, sent_by) VALUES ($1, $2, 'thread', $3)`,
            [id, farmerId, principal.userId]);
        sent += 1;
    }
    return { sent, skipped: farmerIds.length - sent };
}

export async function recordingFile(id: string): Promise<{ storage_key: string; mime_type: string } | null> {
    const { rows } = await query<{ storage_key: string; mime_type: string }>(
        `SELECT u.storage_key, u.mime_type FROM partner_recordings r JOIN upload_records u ON u.id = r.upload_id
          WHERE r.id = $1 AND r.review_status = 'approved'`,
        [id],
    );
    return rows[0] ?? null;
}

/**
 * Whether this person may play a stored file because it is a partner recording: reviewers
 * of an organisation granted the partner may play drafts, anyone in it the approved ones.
 */
export async function mayPlayPartnerUpload(principal: Principal, uploadId: string): Promise<boolean> {
    const scope = await partnerScope(principal, 2);
    const approvedOnly = REVIEWERS.has(principal.role) ? '' : ` AND r.review_status = 'approved'`;
    const { rows } = await query(
        `SELECT 1 FROM partner_recordings r JOIN content_partners p ON p.id = r.partner_id
          WHERE r.upload_id = $1 AND ${scope.sql}${approvedOnly} LIMIT 1`,
        [uploadId, ...scope.params],
    );
    return rows.length > 0;
}

