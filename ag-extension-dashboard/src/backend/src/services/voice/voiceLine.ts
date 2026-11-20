/**
 * The voice question line, for farmers with basic phones who would rather speak than text.
 * A registered farmer calls the number, hears a short greeting, and records a question
 * after the beep. The recording and its transcript go into the farmer's thread with their
 * officer like any message, and the reply goes back by SMS.
 *
 * Africa's Talking calls the callback URL with form fields (isActive, sessionId,
 * callerNumber, recordingUrl...) and expects XML back. The greeting is spoken in English by
 * the provider's voice; for another language, record a person reading it and set
 * VOICE_LINE_GREETING_<LANG> (for example VOICE_LINE_GREETING_SW) to the audio file's URL.
 */
import axios from 'axios';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { onboardingEngine } from '@/services/onboardingEngine';
import { transcribeVoiceNote } from '@/services/voiceAudioService';
import { handleRegisteredFarmerChannelMessage } from '@/services/chat/channelInbound';
import { mediaOnlyText } from '@/services/chat/inboundMedia';
import { smsLanguage } from '@/services/sms/smsCopy';

const MAX_SECONDS = 120;
const RECORDING_HOSTS = /(^|\.)africastalking\.com$/i;

const GREETING =
    'Welcome to your extension service. Your question is recorded and shared with your extension officer. ' +
    'After the beep, say your name and your question, then press the hash key. The answer will come by SMS.';
const THANKS = 'Thank you. Your officer will reply by SMS.';
const NOT_REGISTERED = 'This number is not registered with the extension service. Send an SMS to this number to register, then call again.';

const xmlEscape = (text: string) => text.replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&apos;' }[ch] ?? ch));

/** The greeting: a recorded one in the farmer's language when set, else spoken English. */
function greetingXml(language: string | null | undefined): string {
    const recorded = process.env[`VOICE_LINE_GREETING_${smsLanguage(language).toUpperCase()}`];
    return recorded ? `<Play url="${xmlEscape(recorded)}"/>` : `<Say>${xmlEscape(GREETING)}</Say>`;
}

export interface VoiceCallback {
    isActive?: string;
    sessionId?: string;
    callerNumber?: string;
    recordingUrl?: string;
    durationInSeconds?: string;
}

/** The XML for a call that has just come in. */
export async function answerCall(callback: VoiceCallback): Promise<string> {
    const farmer = callback.callerNumber
        ? await onboardingEngine.findFarmerByIdentifier(callback.callerNumber, 'sms')
        : null;
    if (!farmer) return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(NOT_REGISTERED)}</Say><Reject/></Response>`;
    return '<?xml version="1.0" encoding="UTF-8"?><Response>' +
        `<Record finishOnKey="#" maxLength="${MAX_SECONDS}" trimSilence="true" playBeep="true">${greetingXml(farmer.language_preference)}</Record>` +
        `<Say>${xmlEscape(THANKS)}</Say></Response>`;
}

/** The XML once the question is recorded and the call is still open. */
export function thanksXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(THANKS)}</Say></Response>`;
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
