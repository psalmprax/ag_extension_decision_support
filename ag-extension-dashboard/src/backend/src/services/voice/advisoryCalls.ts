/**
 * Voice advisories: the farmer's phone rings and plays a recorded advisory in their
 * language. For farmers with basic phones who do not read SMS easily. Calls cost money, so
 * there is a daily cap, and farmers who sent STOP are never called.
 *
 * Africa's Talking places the call (POST /call); when the farmer answers, it asks the
 * number's callback (routes/voiceLine) what to play, and the queued call says which clip.
 */
import axios from 'axios';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { VoiceClipError } from './voiceClips';

export const DAILY_CALL_LIMIT = Number(process.env.VOICE_CALL_DAILY_LIMIT || 200);
const CALL_URL = 'https://voice.africastalking.com/call';

export function callingConfigured(): boolean {
    return process.env.VOICE_LINE_ENABLED === 'true' && Boolean(process.env.AFRICASTALKING_API_KEY && process.env.VOICE_LINE_NUMBER);
}

async function placeCall(phone: string): Promise<boolean> {
    const body = new URLSearchParams({
        username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
        from: process.env.VOICE_LINE_NUMBER || '',
        to: phone,
    });
    try {
        const { data } = await axios.post(CALL_URL, body.toString(), {
            headers: { apiKey: process.env.AFRICASTALKING_API_KEY || '', Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15_000,
        });
        const entries: Array<{ status?: string }> = data?.entries ?? [];
        return entries.some(entry => entry.status === 'Queued');
    } catch (error) {
        logger.warn('Voice advisory call could not be placed:', (error as Error).message);
        return false;
    }
}

export interface CallTarget { pilotId?: string; farmerIds?: string[] }

/** Call the farmers (a pilot's service group, or the given farmers) whose language matches the clip. */
export async function callFarmers(requestedBy: string, clipId: string, target: CallTarget): Promise<{ queued: number; skipped: number }> {
    if (!callingConfigured()) throw new VoiceClipError('Voice calls are not set up on this server (VOICE_LINE_ENABLED, VOICE_LINE_NUMBER).', 503);
    const { rows: clips } = await query<{ language: string }>('SELECT language FROM voice_clips WHERE id = $1', [clipId]);
    if (!clips[0]) throw new VoiceClipError('Recording not found', 404);
    if (!target.pilotId && !target.farmerIds?.length) throw new VoiceClipError('Choose a pilot or farmers to call.');
    const { rows: today } = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM voice_calls WHERE created_at > NOW() - INTERVAL '1 day'`);
    const room = DAILY_CALL_LIMIT - Number(today[0]?.count ?? 0);
    if (room <= 0) throw new VoiceClipError(`Today's limit of ${DAILY_CALL_LIMIT} calls is reached.`, 429);

    const { rows: farmers } = await query<{ id: string; phone: string }>(
        `SELECT f.id, f.phone FROM farmers f
          WHERE f.phone IS NOT NULL AND f.sms_opt_out = false AND COALESCE(f.is_demo, false) = false
            AND left(COALESCE(f.language_preference, 'en'), 2) = left($1, 2)
            AND (($2::uuid IS NOT NULL AND f.id IN (SELECT farmer_id FROM pilot_farmers WHERE pilot_id = $2 AND arm = 'service'))
              OR ($2::uuid IS NULL AND f.id = ANY($3::uuid[])))`,
        [clips[0].language, target.pilotId ?? null, target.farmerIds ?? []],
    );
    let queued = 0;
    for (const farmer of farmers.slice(0, room)) {
        await query(
            `INSERT INTO voice_calls (clip_id, farmer_id, phone, requested_by) VALUES ($1, $2, $3, $4)`,
            [clipId, farmer.id, farmer.phone, requestedBy],
        );
        if (await placeCall(farmer.phone)) queued += 1;
        else await query(`UPDATE voice_calls SET status = 'failed' WHERE farmer_id = $1 AND clip_id = $2 AND status = 'queued'`, [farmer.id, clipId]);
    }
    return { queued, skipped: farmers.length - queued };
}

/** The clip waiting for whoever just answered (an outbound call from the last two hours). */
export async function answeredCallClip(phones: string[]): Promise<string | null> {
    const { rows } = await query<{ id: string; clip_id: string }>(
        `SELECT id, clip_id FROM voice_calls
          WHERE phone = ANY($1) AND status = 'queued' AND created_at > NOW() - INTERVAL '2 hours'
          ORDER BY created_at DESC LIMIT 1`,
        [phones.filter(Boolean)],
    );
    if (!rows[0]) return null;
    await query(`UPDATE voice_calls SET status = 'played', answered_at = NOW() WHERE id = $1`, [rows[0].id]);
    return rows[0].clip_id;
}
