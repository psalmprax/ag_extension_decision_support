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
 * /api/ai/analyze-image:
 *   post:
 *     summary: Analyze an image using AI vision capabilities
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze-image', [checkUsageLimit('ai_vision', { meter: false })], async (req: AuthRequest, res: Response) => {
    try {
        const { image, prompt } = req.body;
        const userId = req.user!.userId;

        const result = await AIRouter.routeRequest('vision', {
            imageData: image,
            prompt,
            options: { temperature: 0.3 }
        });

        await usageService.incrementUsage(userId, 'ai_vision');

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Image analysis failed:', error);
        safeError(res, 500, 'Failed to analyze image');
    }
});

/**
 * @swagger
 * /api/ai/analyze-video:
 *   post:
 *     summary: Analyze a video using AI vision capabilities
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze-video', [checkUsageLimit('ai_vision', { meter: false })], async (req: AuthRequest, res: Response) => {
    try {
        const { video, prompt, frameInterval, maxFrames } = req.body;
        const userId = req.user!.userId;

        if (typeof video !== 'string' || video.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Video data is required as a base64 string.' });
        }

        const base64Data = video.includes('base64,') ? video.split('base64,')[1] : video;
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data) || base64Data.length % 4 === 1) {
            return res.status(400).json({ success: false, error: 'Invalid video payload.' });
        }

        const maxBase64Length = Math.ceil((50 * 1024 * 1024 * 4) / 3);
        if (base64Data.length > maxBase64Length) {
            return res.status(413).json({ success: false, error: 'Video exceeds the 50 MB size limit.' });
        }

        const videoBuffer = Buffer.from(base64Data, 'base64');
        if (videoBuffer.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid video payload.' });
        }

        const result = await AIRouter.routeRequest('video', {
            videoData: videoBuffer,
            prompt,
            options: {
                temperature: 0.3,
                frameInterval: frameInterval === undefined ? undefined : Number(frameInterval),
                maxFrames: maxFrames === undefined ? undefined : Number(maxFrames),
            }
        });

        await usageService.incrementUsage(userId, 'ai_vision');

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Video analysis failed:', error);
        safeError(res, 500, 'Failed to analyze video');
    }
});

export default router;
