import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { transcribeVoiceNote, synthesizeVoiceAdvisory } from '@/services/voiceAudioService';
import { generateIvrXml, processDtmfResponse, dispatchVoiceBroadcast } from '@/services/ivrBroadcastService';

const router = Router();

const MAX_AUDIO_BASE64_LENGTH = 16 * 1024 * 1024; // ~12MB binary limit for DoS mitigation

router.post('/voice/transcribe', checkUsageLimit('speech'), validate({ body: z.object({ audio: z.string().optional(), audioUrl: z.string().optional(), mimeType: z.string().optional(), languageHint: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { audio, audioUrl, mimeType, languageHint } = req.body as { audio?: string; audioUrl?: string; mimeType?: string; languageHint?: string };
        if (!audio && !audioUrl) {
            // Fail loudly at the boundary: without input audio the service can
            // only return its offline CI stub transcript, which must never be
            // served over HTTP as if it were a real transcription.
            return res.status(400).json({ success: false, error: 'Audio data or audioUrl is required' });
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
        const { audio, audioUrl, mimeType, languageHint } = req.body as { audio?: string; audioUrl?: string; mimeType?: string; languageHint?: string };
        if (!audio && !audioUrl) {
            return res.status(400).json({ success: false, error: 'Audio data or audioUrl is required' });
        }
        if (audio && audio.length > MAX_AUDIO_BASE64_LENGTH) {
            return res.status(413).json({ success: false, error: 'Audio payload exceeds maximum size limit (12MB).' });
        }
        const audioBuffer = audio ? Buffer.from(audio.includes('base64,') ? audio.split('base64,')[1] : audio, 'base64') : undefined;
        if (audio && (!audioBuffer || audioBuffer.length === 0)) {
            return res.status(400).json({ success: false, error: 'Invalid audio payload: empty or unparseable base64' });
        }
        // Use local Whisper transcription service (free, offline-capable)
        const { whisperTranscriptionService } = await import('@/services/whisperTranscriptionService');
        if (!audioBuffer) {
          throw new Error('No audio buffer provided');
        }
        const result = await whisperTranscriptionService.transcribe(audioBuffer, {
          language: languageHint === 'sw' ? 'sw' : languageHint === 'en' ? 'en' : 'auto',
        });
        return res.json({ success: true, data: { ...result, provider: 'local-whisper' } });
    } catch (e) {
      logger.error('Local Whisper transcribe failed:', e);
      // Fallback to OpenAI if local fails
      const result = await transcribeVoiceNote(req.body as never);
      return res.json({ success: true, data: { ...result, provider: 'openai-fallback' } });
    }
});

router.post('/voice/synthesize', checkUsageLimit('speech'), validate({ body: z.object({ text: z.string().min(1), language: z.enum(['sw','en']).optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await synthesizeVoiceAdvisory(req.body as never) }); } catch (e) { logger.error('Pillar synthesize failed:', e); return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/ivr-xml', checkUsageLimit('ai_chat'), validate({ body: z.object({ alertTitle: z.string().min(1), advisorySwahili: z.string().min(1), advisoryEnglish: z.string().optional(), repeatAllowed: z.boolean().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const xml = generateIvrXml(req.body as never);
        res.setHeader('Content-Type', 'application/xml');
        return res.send(xml);
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/ivr-dtmf', checkUsageLimit('ai_chat'), validate({ body: z.object({ digit: z.string().min(1).max(2) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: processDtmfResponse(req.body.digit) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/broadcast', checkUsageLimit('ai_chat'), validate({ body: z.object({ farmerPhones: z.array(z.string()).min(1), alertTitle: z.string().min(1), advisorySwahili: z.string().min(1), advisoryEnglish: z.string().min(1) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await dispatchVoiceBroadcast(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
