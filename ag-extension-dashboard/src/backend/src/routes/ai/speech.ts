import { Router, Response } from 'express';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '@/services/usageService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/**
 * @swagger
 * /api/ai/transcribe-audio:
 *   post:
 *     summary: Transcribe field observation audio memo via Whisper STT
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/transcribe-audio', [checkUsageLimit('speech', { meter: false })], async (req: AuthRequest, res: Response) => {
    try {
        const { audio, language } = req.body;
        const userId = req.user!.userId;

        if (!audio || typeof audio !== 'string') {
            return res.status(400).json({ success: false, error: 'Audio data is required (base64 string).' });
        }

        const base64Data = audio.includes('base64,') ? audio.split('base64,')[1] : audio;
        const audioBuffer = Buffer.from(base64Data, 'base64');

        if (audioBuffer.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid audio payload.' });
        }

        const result = await AIRouter.routeRequest('speech', {
            audio: audioBuffer,
            options: { language: language || 'en' }
        });

        await usageService.incrementUsage(userId, 'speech');

        return res.json({
            success: true,
            data: {
                text: result?.text || '',
                language: result?.language || language || 'en',
            }
        });
    } catch (error) {
        logger.error('Audio transcription failed:', error);
        return safeError(res, 500, 'Failed to transcribe audio recording');
    }
});

export default router;
