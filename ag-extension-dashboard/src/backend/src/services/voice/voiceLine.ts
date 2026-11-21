/**
 * The voice question line, for farmers with basic phones who would rather speak than text.
 * A registered farmer calls the number, hears a short greeting, and records a question
 * after the beep. The recording and its transcript go into the farmer's thread with their
 * officer like any message, and the reply goes back by SMS.
 *
 * Africa's Talking calls the callback URL with form fields (isActive, sessionId,
 * callerNumber, recordingUrl...) and expects XML back. Prompts are played from the voice
 * library (a person reading them in the caller's language); without a recording they are
 * spoken in English by the provider's voice. The same callback answers voice advisories we
 * place (direction Outbound) by playing the queued recording.
 */
import axios from 'axios';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { onboardingEngine } from '@/services/onboardingEngine';
import { transcribeVoiceNote } from '@/services/voiceAudioService';
import { handleRegisteredFarmerChannelMessage } from '@/services/chat/channelInbound';
import { mediaOnlyText } from '@/services/chat/inboundMedia';
import { smsLanguage } from '@/services/sms/smsCopy';
import { clipFor, clipUrl, PROMPTS, type PromptKey } from './voiceClips';
import { answeredCallClip } from './advisoryCalls';

const MAX_SECONDS = 120;
const RECORDING_HOSTS = /(^|\.)africastalking\.com$/i;

const xmlEscape = (text: string) => text.replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&apos;' }[ch] ?? ch));
const XML = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * A prompt as the caller hears it: the recording in their language from the voice library,
 * else a greeting recording set in VOICE_LINE_GREETING_<LANG>, else the provider's English voice.
 */
export async function promptXml(key: PromptKey, language: string | null | undefined): Promise<string> {
    const clipId = await clipFor(key, language);
    if (clipId) return `<Play url="${xmlEscape(clipUrl(clipId))}"/>`;
    const legacy = key === 'line_greeting' ? process.env[`VOICE_LINE_GREETING_${smsLanguage(language).toUpperCase()}`] : undefined;
    return legacy ? `<Play url="${xmlEscape(legacy)}"/>` : `<Say>${xmlEscape(PROMPTS[key])}</Say>`;
}

export interface VoiceCallback {
    isActive?: string;
    sessionId?: string;
    direction?: string;
    callerNumber?: string;
    destinationNumber?: string;
    recordingUrl?: string;
    durationInSeconds?: string;
}

/** The XML for a call that has just connected: an advisory we placed, or a farmer calling in. */
export async function answerCall(callback: VoiceCallback): Promise<string> {
    if (callback.direction?.toLowerCase() === 'outbound') {
        const clipId = await answeredCallClip([callback.destinationNumber ?? '', callback.callerNumber ?? '']);
        return clipId ? `${XML}<Response><Play url="${xmlEscape(clipUrl(clipId))}"/></Response>` : `${XML}<Response><Reject/></Response>`;
    }
    const farmer = callback.callerNumber
        ? await onboardingEngine.findFarmerByIdentifier(callback.callerNumber, 'sms')
        : null;
    if (!farmer) return `${XML}<Response>${await promptXml('line_not_registered', null)}<Reject/></Response>`;
    return `${XML}<Response>` +
        `<Record finishOnKey="#" maxLength="${MAX_SECONDS}" trimSilence="true" playBeep="true">${await promptXml('line_greeting', farmer.language_preference)}</Record>` +
        `${await promptXml('line_thanks', farmer.language_preference)}</Response>`;
}

/** The XML once the question is recorded and the call is still open. */
export async function thanksXml(callerNumber?: string): Promise<string> {
    const farmer = callerNumber ? await onboardingEngine.findFarmerByIdentifier(callerNumber, 'sms') : null;
    return `${XML}<Response>${await promptXml('line_thanks', farmer?.language_preference)}</Response>`;
}

/** Only the provider's own recording links are fetched. */
export function isProviderRecordingUrl(raw: string): boolean {
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' && RECORDING_HOSTS.test(url.hostname);
    } catch {
        return false;
    }
}

async function firstTime(sessionId: string, phone: string): Promise<boolean> {
    const { rows } = await query<{ event_id: string }>(
        `INSERT INTO messaging_inbound_events (channel, external_identifier, event_id)
         VALUES ('voice', $1, $2) ON CONFLICT (channel, external_identifier, event_id) DO NOTHING RETURNING event_id`,
        [phone, sessionId],
    );
    return rows.length > 0;
}

/** File a finished recording in the farmer's thread (once per call). */
export async function takeRecording(callback: VoiceCallback): Promise<'filed' | 'ignored'> {
    const { recordingUrl, callerNumber, sessionId } = callback;
    if (!recordingUrl || !callerNumber || !sessionId || !isProviderRecordingUrl(recordingUrl)) return 'ignored';
    const farmer = await onboardingEngine.findFarmerByIdentifier(callerNumber, 'sms');
    if (!farmer?.id || !(await firstTime(sessionId, callerNumber))) return 'ignored';

    const response = await axios.get<ArrayBuffer>(recordingUrl, {
        responseType: 'arraybuffer', timeout: 15_000, maxContentLength: 16 * 1024 * 1024, maxRedirects: 0,
    });
    const buffer = Buffer.from(response.data);
    const mimeType = String(response.headers['content-type'] ?? 'audio/mpeg').split(';')[0];
    let text = mediaOnlyText('audio');
    let language: string | undefined;
    try {
        const transcript = await transcribeVoiceNote({ audioBuffer: buffer, mimeType, languageHint: farmer.language_preference ?? undefined });
        if (transcript?.transcription?.trim()) {
            text = transcript.transcription.trim();
            language = transcript.detectedLanguage;
        }
    } catch (error) {
        logger.warn(`Voice line call ${sessionId}: transcription failed, keeping the recording only`, error);
    }
    // Filed as an SMS-channel message, so the officer's reply goes back by SMS.
    await handleRegisteredFarmerChannelMessage({
        farmerId: String(farmer.id), channel: 'sms', text, language, media: [{ buffer, mimeType }],
    });
    return 'filed';
}
