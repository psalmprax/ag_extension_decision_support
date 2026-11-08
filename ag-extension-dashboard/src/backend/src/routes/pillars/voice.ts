import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { transcribeVoiceNote, synthesizeVoiceAdvisory, detectVernacularKeywords } from '@/services/voiceAudioService';
import { generateIvrXml, processDtmfResponse, dispatchVoiceBroadcast } from '@/services/ivrBroadcastService';

const router = Router();

const MAX_AUDIO_BASE64_LENGTH = 16 * 1024 * 1024; // ~12MB binary limit for DoS mitigation

async function transcribeLocalOrFallback(audioBuffer: Buffer, mimeType?: string, languageHint?: string) {
    try {
        const { whisperTranscriptionService } = await import('@/services/whisperTranscriptionService');
        const result = await whisperTranscriptionService.transcribe(audioBuffer, {
            language: languageHint === 'sw' ? 'sw' : languageHint === 'en' ? 'en' : 'auto',
        });
        if (!result.text?.trim()) throw new Error('Local speech provider returned an empty transcript');
        return {
            ...result, transcription: result.text.trim(), detectedLanguage: result.language || 'unknown',
            agronomicKeywords: detectVernacularKeywords(result.text).keywords, provider: 'local-whisper',
        };
    } catch (error) {
        logger.warn('Local Whisper transcribe failed; trying cloud fallback:', error);
        const result = await transcribeVoiceNote({ audioBuffer, mimeType, languageHint, skipLocal: true });
        return { ...result, provider: 'openai-fallback' };
    }
}

router.post('/voice/transcribe', checkUsageLimit('speech'), validate({ body: z.object({ audio: z.string().optional(), audioUrl: z.string().optional(), mimeType: z.string().optional(), languageHint: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { audio, audioUrl, mimeType, languageHint } = req.body as { audio?: string; audioUrl?: string; mimeType?: string; languageHint?: string };
        if (!audio) {
            return res.status(400).json({ success: false, error: 'Audio data is required; audio URLs are not supported' });
        }
        if (audio && audio.length > MAX_AUDIO_BASE64_LENGTH) {
            return res.status(413).json({ success: false, error: 'Audio payload exceeds maximum size limit (12MB).' });
        }
        const audioBuffer = audio ? Buffer.from(audio.includes('base64,') ? audio.split('base64,')[1] : audio, 'base64') : undefined;
        if (audio && (!audioBuffer || audioBuffer.length === 0)) {
            return res.status(400).json({ success: false, error: 'Invalid audio payload: empty or unparseable base64' });
        }
        const result = await transcribeVoiceNote({ audioBuffer, audioUrl, mimeType, languageHint });
        return res.json({ success: true, data: result });
    } catch (e) { logger.error('Pillar transcribe failed:', e); return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/transcribe-local', checkUsageLimit('speech'), validate({ body: z.object({ audio: z.string().optional(), audioUrl: z.string().optional(), mimeType: z.string().optional(), languageHint: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { audio, mimeType, languageHint } = req.body as { audio?: string; mimeType?: string; languageHint?: string };
        if (!audio) {
            return res.status(400).json({ success: false, error: 'Audio data is required; audio URLs are not supported' });
        }
        if (audio && audio.length > MAX_AUDIO_BASE64_LENGTH) {
            return res.status(413).json({ success: false, error: 'Audio payload exceeds maximum size limit (12MB).' });
        }
        const audioBuffer = audio ? Buffer.from(audio.includes('base64,') ? audio.split('base64,')[1] : audio, 'base64') : undefined;
        if (audio && (!audioBuffer || audioBuffer.length === 0)) {
            return res.status(400).json({ success: false, error: 'Invalid audio payload: empty or unparseable base64' });
        }
        if (!audioBuffer) {
          throw new Error('No audio buffer provided');
        }
        const result = await transcribeLocalOrFallback(audioBuffer, mimeType, languageHint);
        return res.json({ success: true, data: result });
    } catch (e) {
      logger.error('Voice transcription unavailable:', e);
      return safeError(res, 503, 'Voice transcription unavailable');
    }
});

router.post('/voice/synthesize', checkUsageLimit('speech'), validate({ body: z.object({ text: z.string().min(1).max(4000), language: z.enum(['sw','en']).optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await synthesizeVoiceAdvisory(req.body as never) }); } catch (e) { logger.error('Pillar synthesize failed:', e); return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/ivr-xml', checkUsageLimit('ai_chat'), validate({ body: z.object({ alertTitle: z.string().min(1).max(200), advisorySwahili: z.string().min(1).max(4000), advisoryEnglish: z.string().max(4000).optional(), repeatAllowed: z.boolean().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const xml = generateIvrXml(req.body as never);
        res.setHeader('Content-Type', 'application/xml');
        return res.send(xml);
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/ivr-dtmf', checkUsageLimit('ai_chat'), validate({ body: z.object({ digit: z.string().min(1).max(2).regex(/^[0-9*#]+$/) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: processDtmfResponse(req.body.digit) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/broadcast', checkUsageLimit('ai_chat'), validate({ body: z.object({ farmerPhones: z.array(z.string().min(5).max(25)).min(1).max(500), alertTitle: z.string().min(1).max(200), advisorySwahili: z.string().min(1).max(4000), advisoryEnglish: z.string().min(1).max(4000) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await dispatchVoiceBroadcast(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
