import { Router, Request, Response } from 'express';
import { getAudioMimeType, transcribeVoiceNote, synthesizeVoiceAdvisory } from '@/services/voiceAudioService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { safeError } from '@/utils/safeResponse';

const router = Router();
const MAX_AUDIO_BASE64_LENGTH = 16 * 1024 * 1024;

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Speech to text
router.post('/speech-to-text', checkUsageLimit('speech'), async (req: Request, res: Response) => {
    try {
        const { audio, language = 'en' } = req.body;

        if (typeof audio !== 'string' || !audio) {
            return res.status(400).json({ success: false, error: 'Audio data is required' });
        }
        if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
            return res.status(413).json({ success: false, error: 'Audio payload exceeds maximum size limit.' });
        }

        const base64Audio = audio.includes('base64,') ? audio.split('base64,')[1] : audio;
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        if (audioBuffer.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid audio payload.' });
        }
        const result = await transcribeVoiceNote({
            audioBuffer,
            mimeType: getAudioMimeType(audio),
            languageHint: language,
        });

        res.json({
            success: true,
            data: {
                text: result.transcription,
                language: result.detectedLanguage,
            },
        });
    } catch (error) {
        logger.error('Speech to text error:', error);
        safeError(res, 500, 'Transcription failed');
    }
});

// Text to speech
router.post('/text-to-speech', checkUsageLimit('speech'), async (req: Request, res: Response) => {
    try {
        const { text, language = 'en', voice = 'default' } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: 'Text is required' });
        }

        const result = await synthesizeVoiceAdvisory({
            text,
            language: language === 'sw' ? 'sw' : 'en',
        });
        if (!result.audioBase64) {
            return res.status(503).json({ success: false, error: 'Speech synthesis unavailable' });
        }

        res.json({
            success: true,
            data: {
                audioUrl: result.audioBase64,
                format: 'audio/mp3',
            },
        });
    } catch (error) {
        logger.error('Text to speech error:', error);
        safeError(res, 500, 'TTS generation failed');
    }
});

export default router;