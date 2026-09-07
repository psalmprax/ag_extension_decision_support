import { Router, Response } from 'express';
import { validate } from '@/middleware/validate';
import { aiSchemas } from '@/schemas';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '@/services/usageService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { safeError } from '@/utils/safeResponse';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

const router = Router();

interface StructuredVisitData {
    summary: string;
    keyObservations: string[];
    recommendedActions: string[];
    cropHealthStatus: 'good' | 'fair' | 'poor' | 'diseased';
    pestIssues: string;
    followUpRequired: boolean;
    nextVisitDateHint: string;
}

function parseCropHealthStatus(rawStatus: unknown): 'good' | 'fair' | 'poor' | 'diseased' {
    const valid = ['good', 'fair', 'poor', 'diseased'] as const;
    const str = String(rawStatus || '').toLowerCase();
    return (valid as readonly string[]).includes(str) ? (str as 'good' | 'fair' | 'poor' | 'diseased') : 'fair';
}

function extractStringArray(value: unknown, fallback: string[]): string[] {
    if (Array.isArray(value)) {
        const filtered = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        if (filtered.length > 0) return filtered;
    } else if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
    }
    return fallback;
}

function normalizeVisitSynthesisResult(rawResponse: string, originalNotes: string): StructuredVisitData {
    try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)?.[0] || rawResponse;
        const parsed = JSON.parse(jsonMatch);
        return {
            summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : originalNotes.slice(0, 300),
            keyObservations: extractStringArray(parsed.keyObservations, ['Field observations recorded.']),
            recommendedActions: extractStringArray(parsed.recommendedActions, ['Schedule follow-up assessment.']),
            cropHealthStatus: parseCropHealthStatus(parsed.cropHealthStatus),
            pestIssues: typeof parsed.pestIssues === 'string' && parsed.pestIssues.trim() ? parsed.pestIssues.trim() : 'None reported',
            followUpRequired: Boolean(parsed.followUpRequired),
            nextVisitDateHint: typeof parsed.nextVisitDateHint === 'string' && parsed.nextVisitDateHint.trim() ? parsed.nextVisitDateHint.trim() : '7-14 days',
        };
    } catch {
        return {
            summary: rawResponse.slice(0, 500) || originalNotes.slice(0, 300),
            keyObservations: [originalNotes.slice(0, 200)],
            recommendedActions: ['Conduct follow-up field inspection.'],
            cropHealthStatus: 'fair',
            pestIssues: 'None detected',
            followUpRequired: true,
            nextVisitDateHint: '7-10 days',
        };
    }
}

/**
 * @swagger
 * /api/ai/synthesize-visit:
 *   post:
 *     summary: Synthesize structured visit data from notes/transcripts
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/synthesize-visit', [checkUsageLimit('ai_chat', { meter: false }), validate({ body: aiSchemas.synthesizeVisit })], async (req: AuthRequest, res: Response) => {
    try {
        const { notes } = req.body;
        const userId = req.user!.userId;

        // 1. Check Semantic Cache first
        const cachedResult = await SemanticCacheService.findSimilar(notes);
        if (cachedResult) {
            return res.json({
                success: true,
                data: JSON.parse(cachedResult.answer),
                source: 'cache'
            });
        }

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

        const structuredData = normalizeVisitSynthesisResult(result.text || '', notes);

        // Agronomic safety boundary: block/quarantine lethal chemical or
        // quarantine-disease recommendations before they reach the farmer.
        const adviceBlob = [structuredData.summary, ...structuredData.recommendedActions].join('\n');
        const safety = agronomicSafetyGuard.scanGeneratedAdvice(adviceBlob);
        if (!safety.safe) {
            logger.warn(
                `Visit synthesis blocked by AgronomicSafetyGuard (${safety.hazardLevel}) — user ${userId}: ${safety.violations.join('; ')}`
            );
            return res.status(422).json({
                success: false,
                error: 'Generated advice failed agronomic safety review and was withheld.',
                safety,
            });
        }

        await SemanticCacheService.save(notes, JSON.stringify(structuredData), { userId, type: 'visit_synthesis' });
        await usageService.incrementUsage(userId, 'ai_chat');

        res.json({
            success: true,
            data: structuredData,
            source: 'llm'
        });
    } catch (error) {
        logger.error('Visit synthesis failed:', error);
        safeError(res, 500, 'Failed to synthesize visit data');
    }
});

export default router;
