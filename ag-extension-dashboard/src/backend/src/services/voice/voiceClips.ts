/**
 * Recordings of a person reading the voice line's prompts and advisories, one per message
 * and language. Callers hear these instead of the provider's English voice. Phones play mp3
 * or wav, so recordings are uploaded in those formats (a phone's voice recorder can export
 * either). The provider fetches a recording through a signed link, since it has no session.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { query } from '@/services/databaseService';
import { config } from '@/config';

export class VoiceClipError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}

/** The voice line's own prompts, with what the recording should say. */
export const PROMPTS = {
    line_greeting: 'Welcome to your extension service. Your question is recorded and shared with your extension officer. After the beep, say your name and your question, then press the hash key. The answer will come by SMS.',
    line_thanks: 'Thank you. Your officer will reply by SMS.',
    line_not_registered: 'This number is not registered with the extension service. Send an SMS to this number to register, then call again.',
} as const;
export type PromptKey = keyof typeof PROMPTS;

const PLAYABLE = new Set(['audio/mpeg', 'audio/wav']);

export interface ClipRow {
    id: string; key: string; language: string; title: string; transcript: string | null;
    storage_key: string; mime_type: string; created_at: Date;
}

export async function listClips(): Promise<ClipRow[]> {
    const { rows } = await query<ClipRow>(
        `SELECT c.id, c.key, c.language, c.title, c.transcript, u.storage_key, u.mime_type, c.created_at
           FROM voice_clips c JOIN upload_records u ON u.id = c.upload_id
          ORDER BY c.key, c.language`,
    );
    return rows;
}

export interface ClipInput { key: string; language: string; title: string; transcript?: string; uploadId: string }

/** Save (or replace) the recording for a message in a language. */
export async function saveClip(userId: string, input: ClipInput): Promise<{ id: string }> {
    const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').slice(0, 80);
    const language = input.language.trim().toLowerCase().slice(0, 10);
    if (!key || !/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(language)) throw new VoiceClipError('Give the message and a language code such as sw or ha.');
    const { rows: uploads } = await query<{ mime_type: string; owner_user_id: string }>(
        `SELECT mime_type, owner_user_id FROM upload_records WHERE id = $1 AND status = 'active'`,
        [input.uploadId],
    );
    const upload = uploads[0];
    if (!upload || upload.owner_user_id !== userId) throw new VoiceClipError('Recording not found', 404);
    if (!PLAYABLE.has(upload.mime_type)) throw new VoiceClipError('Phones play mp3 or wav recordings. Export the recording in one of those formats.');
    const { rows } = await query<{ id: string }>(
        `INSERT INTO voice_clips (key, language, title, transcript, upload_id, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key, language) DO UPDATE SET title = EXCLUDED.title, transcript = EXCLUDED.transcript,
             upload_id = EXCLUDED.upload_id, recorded_by = EXCLUDED.recorded_by, created_at = NOW()
         RETURNING id`,
        [key, language, input.title.trim().slice(0, 200), input.transcript?.trim() || null, input.uploadId, userId],
    );
    return { id: rows[0].id };
}

export async function deleteClip(id: string): Promise<boolean> {
    const { rowCount } = await query('DELETE FROM voice_clips WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
}

const signature = (clipId: string) => createHmac('sha256', config.jwt.secret).update(`voice-clip:${clipId}`).digest('hex').slice(0, 32);

export function isValidClipSignature(clipId: string, sig: unknown): boolean {
    if (typeof sig !== 'string' || sig.length !== 32) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(signature(clipId)));
}

/** A link the voice provider can fetch without signing in. */
export function clipUrl(clipId: string): string {
    const base = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/$/, '');
    return `${base}/api/v1/voice-clips/${clipId}/audio?sig=${signature(clipId)}`;
}

/** The recording for a message in the caller's language (a two-letter match is enough), if any. */
export async function clipFor(key: string, language: string | null | undefined): Promise<string | null> {
    const lang = (language || 'en').toLowerCase();
    const { rows } = await query<{ id: string }>(
        `SELECT id FROM voice_clips WHERE key = $1 AND (language = $2 OR language = left($2, 2))
          ORDER BY (language = $2) DESC LIMIT 1`,
        [key, lang],
    );
    return rows[0]?.id ?? null;
}

export async function clipFile(clipId: string): Promise<{ storage_key: string; mime_type: string } | null> {
    const { rows } = await query<{ storage_key: string; mime_type: string }>(
        `SELECT u.storage_key, u.mime_type FROM voice_clips c JOIN upload_records u ON u.id = c.upload_id WHERE c.id = $1`,
        [clipId],
    );
    return rows[0] ?? null;
}
