import { Router, Response } from 'express';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '@/services/usageService';
import { safeError } from '@/utils/safeResponse';
import { MAX_VIDEO_BYTES } from '@/services/aiProvider/videoFrameService';

const router = Router();
const OBSERVATION_LABELS = [
    'yellow leaves', 'brown spots', 'white patches', 'leaf holes', 'wilting',
    'leaf curling', 'other visible damage', 'no clear symptoms',
];
const OBSERVATION_PROMPT = `Return only JSON in the form {"observations":["label"]}. Choose one or more exact labels from: ${OBSERVATION_LABELS.join(', ')}. Do not identify a disease or recommend treatment.`;

function parseVideoObservations(text: string, framesAnalyzed: number): string | null {
    const frames = text.split(/(?:^|\n\n)Frame \d+: /);
    if (frames.shift() !== '' || frames.length !== framesAnalyzed) return null;
    const lines: string[] = [];
    for (const [index, frame] of frames.entries()) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(frame.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''));
        } catch {
            return null;
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const record = parsed as Record<string, unknown>;
        if (Object.keys(record).length !== 1 || !Array.isArray(record.observations) ||
            record.observations.length === 0 || record.observations.length > OBSERVATION_LABELS.length ||
            !record.observations.every(label => typeof label === 'string' && OBSERVATION_LABELS.includes(label))) return null;
        lines.push(`Frame ${index + 1}: ${record.observations.join(', ')}`);
    }
    return lines.join('\n');
}

function decodeVideo(video: unknown, res: Response): Buffer | null {
    if (typeof video !== 'string' || video.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Video data is required as a base64 string.' });
        return null;
    }
    const base64Data = video.includes('base64,') ? video.split('base64,')[1] : video;
    if (base64Data.length > Math.ceil(MAX_VIDEO_BYTES / 3) * 4) {
        res.status(413).json({ success: false, error: 'Video exceeds the 30 MB size limit.' });
        return null;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data) || base64Data.length % 4 === 1) {
        res.status(400).json({ success: false, error: 'Invalid video payload.' });
        return null;
    }
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_VIDEO_BYTES) {
        res.status(buffer.length === 0 ? 400 : 413).json({
            success: false, error: buffer.length === 0 ? 'Invalid video payload.' : 'Video exceeds the 30 MB size limit.',
        });
        return null;
    }
    return buffer;
}

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
        const { video, prompt, frameInterval, maxFrames, mode } = req.body;
        const userId = req.user!.userId;

        const videoBuffer = decodeVideo(video, res);
        if (!videoBuffer) return;

        const result = await AIRouter.routeRequest('video', {
            videoData: videoBuffer,
            prompt: mode === 'crop_observations' ? OBSERVATION_PROMPT : prompt,
            options: {
                temperature: 0.3,
                frameInterval: frameInterval === undefined ? undefined : Number(frameInterval),
                maxFrames: maxFrames === undefined ? undefined : Number(maxFrames),
            }
        });

        if (mode === 'crop_observations') {
            const observations = typeof result?.analysis === 'string' &&
                Number.isInteger(result.framesAnalyzed) && result.framesAnalyzed > 0
                ? parseVideoObservations(result.analysis, result.framesAnalyzed) : null;
            if (!observations) {
                logger.warn('Video observations unavailable: provider returned invalid output');
                return safeError(res, 502, 'Video observations unavailable. Please try again or consult an extension officer.');
            }
            result.analysis = observations;
        }

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
