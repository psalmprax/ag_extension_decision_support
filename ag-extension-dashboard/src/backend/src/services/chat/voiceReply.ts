import { logger } from '@/utils/logger';
import { synthesizeVoiceAdvisory } from '@/services/voiceAudioService';

/**
 * A spoken version of a reply, for farmers who send voice notes, as a data
 * URL WhatsApp can deliver. Undefined when synthesis is unavailable: the
 * text still goes out.
 */
export async function synthesizeVoiceReply(text: string, language?: string | null): Promise<string | undefined> {
    try {
        const langCode = language === 'sw' || language === 'en' ? language : 'sw';
        const syn = await synthesizeVoiceAdvisory({ text, language: langCode });
        if (syn?.audioBase64) return `data:${syn.format};base64,${syn.audioBase64}`;
    } catch (err) {
        logger.warn('Failed to synthesize a voice reply:', err);
    }
    return undefined;
}
