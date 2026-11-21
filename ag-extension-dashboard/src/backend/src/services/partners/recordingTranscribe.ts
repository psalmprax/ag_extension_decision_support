/**
 * Transcribing imported recordings, one at a time in the background (local Whisper first,
 * then the speech APIs). A transcript is a draft: it grounds nothing until a reviewer has
 * checked it against the audio. When no speech service is available the recording stays
 * pending and is tried again on the next pass, rather than being marked as failed.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { readStoredUpload } from '@/services/uploadService';
import { transcribeVoiceNote } from '@/services/voiceAudioService';

const BATCH = Number(process.env.PARTNER_TRANSCRIBE_BATCH || 10);
const UNAVAILABLE = /transcription unavailable/i;

let running = false;

/** Transcribe up to one batch of pending recordings; returns how many got a transcript. */
export async function transcribePendingRecordings(): Promise<number> {
    if (running) return 0;
    running = true;
    let done = 0;
    try {
        const { rows } = await query<{ id: string; language: string; storage_key: string; mime_type: string }>(
            `SELECT r.id, r.language, u.storage_key, u.mime_type
               FROM partner_recordings r JOIN upload_records u ON u.id = r.upload_id
              WHERE r.transcript_status = 'pending'
              ORDER BY r.created_at
              LIMIT $1`,
            [BATCH],
        );
        for (const recording of rows) {
            try {
                const audio = await readStoredUpload(recording.storage_key);
                const result = await transcribeVoiceNote({ audioBuffer: audio, mimeType: recording.mime_type, languageHint: recording.language });
                await query(
                    `UPDATE partner_recordings SET transcript = $2, transcript_status = 'transcribed' WHERE id = $1 AND transcript_status = 'pending'`,
                    [recording.id, result.transcription.trim()],
                );
                done += 1;
            } catch (error) {
                if (UNAVAILABLE.test((error as Error).message)) {
                    logger.warn('No speech service is available; partner recordings stay pending until one is.');
                    break;
                }
                logger.warn(`Partner recording ${recording.id} could not be transcribed:`, error);
                await query(`UPDATE partner_recordings SET transcript_status = 'failed' WHERE id = $1`, [recording.id]);
            }
        }
    } finally {
        running = false;
    }
    return done;
}

/** Start a pass without waiting for it (after an import). */
export function transcribeInBackground(): void {
    setImmediate(() => {
        transcribePendingRecordings().catch(error => logger.warn('Partner recording transcription pass failed:', error));
    });
}
