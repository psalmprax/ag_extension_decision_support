/**
 * Files sent to the Telegram bot: the largest size of a photo, a video, or a voice note
 * (transcribed, like WhatsApp voice notes). The caption, if any, is the message text.
 */
import { telegramService } from '@/services/telegramService';
import { mediaKind, mediaOnlyText } from './inboundMedia';
import { transcribeInboundAudio, type InboundContent } from './whatsappInboundMedia';

interface TelegramFileRef { file_id: string; file_size?: number; mime_type?: string }

export interface TelegramMessage {
    text?: string;
    caption?: string;
    photo?: TelegramFileRef[];
    video?: TelegramFileRef;
    voice?: TelegramFileRef;
    audio?: TelegramFileRef;
}

/** The file in a message and its type; Telegram sends photos as JPEG and voice notes as Ogg. */
function fileOf(message: TelegramMessage): { fileId: string; mimeType: string } | null {
    if (message.photo?.length) return { fileId: message.photo[message.photo.length - 1].file_id, mimeType: 'image/jpeg' };
    if (message.video) return { fileId: message.video.file_id, mimeType: message.video.mime_type || 'video/mp4' };
    if (message.voice) return { fileId: message.voice.file_id, mimeType: message.voice.mime_type || 'audio/ogg' };
    if (message.audio) return { fileId: message.audio.file_id, mimeType: message.audio.mime_type || 'audio/mpeg' };
    return null;
}

export function hasTelegramFile(message: TelegramMessage): boolean {
    return fileOf(message) !== null;
}

export async function readTelegramContent(message: TelegramMessage): Promise<InboundContent> {
    const content: InboundContent = { body: message.text || message.caption || '', isVoice: false, detectedLang: 'sw', media: [] };
    const ref = fileOf(message);
    const kind = ref ? mediaKind(ref.mimeType) : null;
    if (!ref || !kind) return content;
    const buffer = await telegramService.downloadFile(ref.fileId);
    if (!buffer) return content;
    content.media.push({ buffer, mimeType: ref.mimeType });
    if (kind === 'audio') {
        const transcript = await transcribeInboundAudio({ buffer, mimeType: ref.mimeType });
        if (transcript?.transcription) {
            content.isVoice = true;
            content.detectedLang = transcript.detectedLanguage;
            content.body = content.body.trim() ? `${content.body}\n[Audio transcript]: ${transcript.transcription}` : transcript.transcription;
        }
    }
    if (!content.body.trim()) content.body = mediaOnlyText(kind);
    return content;
}
