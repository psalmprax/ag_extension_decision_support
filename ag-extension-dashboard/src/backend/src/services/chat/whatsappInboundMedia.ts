/**
 * Files that arrive with a WhatsApp message. Voice notes are transcribed (the transcript
 * becomes the message text); photos, videos and the voice note itself are kept so the
 * officer can open them in the thread. Provider URLs are fetched only when they cannot
 * reach internal addresses.
 */
import axios from 'axios';
import { logger } from '@/utils/logger';
import { transcribeVoiceNote } from '@/services/voiceAudioService';
import { mediaKind, mediaOnlyText, type InboundMedia } from './inboundMedia';

export interface WhatsAppMediaPayload {
    MediaUrl0?: string;
    MediaContentType0?: string;
    audioUrl?: string;
    audioBase64?: string;
    mimeType?: string;
    mediaContentType?: string;
}

const SSRF_BLOCKED_HOSTS = new Set([
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '[::]',
]);

const SSRF_BLOCKED_PREFIXES = [
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
    '127.',
    '169.254.',
    '0.',
    '[fe8',
    '[fc',
    '[fd',
    '[::',
];

const SSRF_BLOCKED_DOMAINS = [
    '.internal',
    '.local',
    '.lan',
    '.localhost',
    '.localdomain',
    '.corp',
];

function isSafeWebhookMediaUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        const lowerHost = parsed.hostname.toLowerCase();
        if (SSRF_BLOCKED_HOSTS.has(lowerHost)) return false;
        for (const prefix of SSRF_BLOCKED_PREFIXES) {
            if (lowerHost.startsWith(prefix)) return false;
        }
        for (const domain of SSRF_BLOCKED_DOMAINS) {
            if (lowerHost.endsWith(domain)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

function parseBase64Media(rawBase64: string, mimeType: string): { buffer: Buffer; mimeType: string } | null {
    if (rawBase64.length > 16 * 1024 * 1024) {
        logger.warn('Rejected inbound WhatsApp media: exceeds 16MB limit');
        return null;
    }
    const cleanBase64 = rawBase64.includes('base64,') ? rawBase64.split('base64,')[1] : rawBase64;
    const buf = Buffer.from(cleanBase64, 'base64');
    if (buf.length === 0) {
        logger.warn('Rejected inbound WhatsApp media: empty or unparseable payload');
        return null;
    }
    return { buffer: buf, mimeType };
}

async function downloadRemoteMedia(url: string, mimeType: string): Promise<{ buffer?: Buffer; url: string; mimeType: string } | null> {
    if (!isSafeWebhookMediaUrl(url)) {
        logger.warn(`Rejected potential SSRF or unsupported media URL in WhatsApp inbound: ${url}`);
        return null;
    }
    try {
        const resp = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000,
            maxContentLength: 16 * 1024 * 1024,
            maxRedirects: 3,
            beforeRedirect: (options: Record<string, unknown>) => {
                const target = (options.href as string) || `${options.protocol}//${options.host}${options.path}`;
                if (!isSafeWebhookMediaUrl(target)) {
                    throw new Error(`SSRF blocked redirect to ${target}`);
                }
            },
        });
        return { buffer: Buffer.from(resp.data), url, mimeType };
    } catch (err) {
        logger.warn('Could not download media from the WhatsApp provider:', err);
        return { url, mimeType };
    }
}

/** The file sent with a WhatsApp message (Twilio MediaUrl0, or a base64 test payload), if any. */
async function resolveMediaPayload(payload: WhatsAppMediaPayload): Promise<{ buffer?: Buffer; url?: string; mimeType: string } | null> {
    const mimeType = payload.MediaContentType0 || payload.mimeType || payload.mediaContentType || 'audio/ogg';

    if (payload.audioBase64) {
        return parseBase64Media(payload.audioBase64, mimeType);
    }

    const url = payload.MediaUrl0 || payload.audioUrl;
    if (url) {
        return await downloadRemoteMedia(url, mimeType);
    }

    return null;
}

export async function transcribeInboundAudio(audioInfo: { buffer?: Buffer; url?: string; mimeType: string }): Promise<{ transcription: string; detectedLanguage: 'sw' | 'en' | string } | null> {
    try {
        const tr = await transcribeVoiceNote({
            audioBuffer: audioInfo.buffer,
            audioUrl: audioInfo.url,
            mimeType: audioInfo.mimeType,
            languageHint: 'sw',
        });
        return {
            transcription: tr.transcription,
            detectedLanguage: tr.detectedLanguage || 'sw',
        };
    } catch (err) {
        logger.error('Failed to transcribe inbound voice note:', err);
        return null;
    }
}

export interface InboundContent {
    /** The caption or text, the voice-note transcript, or a short "Sent a photo." line. */
    body: string;
    isVoice: boolean;
    detectedLang: string;
    media: InboundMedia[];
}

/** Turn the text and any file of an inbound WhatsApp message into thread content. */
export async function readInboundContent(payload: WhatsAppMediaPayload, text: string): Promise<InboundContent> {
    const content: InboundContent = { body: text, isVoice: false, detectedLang: 'sw', media: [] };
    const file = await resolveMediaPayload(payload);
    if (!file) return content;
    const kind = mediaKind(file.mimeType);
    if (file.buffer && kind) content.media.push({ buffer: file.buffer, mimeType: file.mimeType });
    if (kind === 'image' || kind === 'video') {
        if (!content.body.trim()) content.body = mediaOnlyText(kind);
        return content;
    }
    const tr = await transcribeInboundAudio(file);
    if (tr) {
        content.isVoice = true;
        content.detectedLang = tr.detectedLanguage;
        content.body = content.body.trim().length === 0 ? tr.transcription : `${content.body}\n[Audio transcript]: ${tr.transcription}`;
    } else if (!content.body.trim() && content.media.length) {
        content.body = mediaOnlyText('audio');
    }
    return content;
}
