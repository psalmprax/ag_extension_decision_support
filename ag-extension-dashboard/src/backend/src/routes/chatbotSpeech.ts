import { Router, Request, Response } from 'express';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { safeError } from '@/utils/safeResponse';

const router = Router();

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Speech to text
router.post('/speech-to-text', checkUsageLimit('speech'), async (req: Request, res: Response) => {
    try {
        const { audio, language = 'en' } = req.body;

        if (!audio) {
            return res.status(400).json({ success: false, error: 'Audio data is required' });
        }

        // Use AI provider for speech recognition
        const provider = await AIProviderFactory.getProvider();
        const result = await provider.speechToText(Buffer.from(audio, 'base64'), { language });

        res.json({
            success: true,
            data: result,
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

        const provider = await AIProviderFactory.getProvider();
        const result = await provider.textToSpeech(text, { language, voice });

        res.json({
            success: true,
            data: {
                audioUrl: result.audio.toString('base64'),
                format: result.format,
            },
        });
    } catch (error) {
        logger.error('Text to speech error:', error);
        safeError(res, 500, 'TTS generation failed');
    }
});

export default router;