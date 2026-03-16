import { Router, Response } from 'express';
import { validate } from '@/middleware/validate';
import { aiSchemas } from '@/schemas';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '@/services/usageService';

const router = Router();

// Apply authentication to all AI routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

/**
 * @swagger
 * /api/ai/synthesize-visit:
 *   post:
 *     summary: Synthesize structured visit data from notes/transcripts
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/synthesize-visit', [checkUsageLimit('ai_chat'), validate({ body: aiSchemas.synthesizeVisit })], async (req: AuthRequest, res: Response) => {
    try {
        const { notes } = req.body;
        const userId = req.user!.userId;

        const prompt = `
            You are an expert Agricultural Extension Officer Assistant. 
            Analyze the following field visit notes/transcript and extract structured data.
            
            NOTES:
            "${notes}"
            
            Return ONLY a JSON object with this structure:
            {
              "summary": "Brief summary of the visit",
              "keyObservations": ["list", "of", "observations"],
              "recommendedActions": ["list", "of", "actions"],
              "cropHealthStatus": "good|fair|poor|diseased",
              "pestIssues": "Describe any pests found, or 'none'",
              "followUpRequired": true/false,
              "nextVisitDateHint": "Suggested timeframe for next visit"
            }
        `;

        const result = await AIRouter.routeRequest('generate', {
            prompt,
            options: { temperature: 0.1 }
        });

        // The result.text usually contains the JSON
        let structuredData = {};
        try {
            // Basic extraction if the model adds markdown backticks
            const jsonText = result.text.match(/\{[\s\S]*\}/)?.[0] || result.text;
            structuredData = JSON.parse(jsonText);
        } catch (e) {
            logger.error('Failed to parse AI JSON response:', e);
            structuredData = { rawResponse: result.text };
        }

        // Increment usage
        await usageService.incrementUsage(userId, 'ai_chat');

        res.json({
            success: true,
            data: structuredData
        });
    } catch (error) {
        logger.error('Visit synthesis failed:', error);
        res.status(500).json({ success: false, error: 'Failed to synthesize visit data' });
    }
});

export default router;
