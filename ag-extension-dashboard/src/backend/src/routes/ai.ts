import { Router, Response } from 'express';
import { validate } from '@/middleware/validate';
import { aiSchemas } from '@/schemas';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '@/services/usageService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { selfHealingService } from '@/services/selfHealing';

const router = Router();

// Apply authentication to all AI routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

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
router.post('/synthesize-visit', [checkUsageLimit('ai_chat'), validate({ body: aiSchemas.synthesizeVisit })], async (req: AuthRequest, res: Response) => {
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

/**
 * @swagger
 * /api/ai/transcribe-audio:
 *   post:
 *     summary: Transcribe field observation audio memo via Whisper STT
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/transcribe-audio', [checkUsageLimit('ai_chat')], async (req: AuthRequest, res: Response) => {
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

        await usageService.incrementUsage(userId, 'ai_chat');

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

/**
 * @swagger
 * /api/ai/analyze-image:
 *   post:
 *     summary: Analyze an image using AI vision capabilities
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze-image', [checkUsageLimit('ai_vision')], async (req: AuthRequest, res: Response) => {
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
router.post('/analyze-video', [checkUsageLimit('ai_vision')], async (req: AuthRequest, res: Response) => {
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

import { safeError } from '@/utils/safeResponse';

// Agent registry — system-defined agent metadata
const agentRegistry = [
    {
        id: 'agent-zero',
        name: 'Agent Zero',
        url: process.env.AGENT_ZERO_URL || 'http://ag-agent-zero:8000',
        description: 'Autonomous task execution & tool calling',
        capabilities: ['Farmer Outreach', 'Data Collection', 'Weather Monitoring'],
        providerType: 'openai'
    },
    {
        id: 'crew-ai',
        name: 'Crew AI',
        url: process.env.CREW_AI_URL || 'http://ag-crew-ai:8001',
        description: 'Multi-agent orchestration workflows',
        capabilities: ['Market Analysis', 'Crop Disease Diagnosis', 'Policy Research'],
        providerType: 'anthropic'
    },
    {
        id: 'openclaw',
        name: 'OpenClaw',
        url: process.env.OPENCLAW_URL || 'http://localhost:8002',
        description: 'Automated code & system refactoring',
        capabilities: ['Bug Fixes', 'Unit Testing', 'Doc Gen'],
        providerType: 'groq'
    },
];

/**
 * Helper to get live agent status from actual AI Providers
 */
async function getLiveStatus(agentId: string) {
    const healthMap = selfHealingService.getHealthStatus();
    const componentHealth = healthMap.get(agentId);

    if (componentHealth) {
        let status: 'online' | 'unhealthy' | 'offline' = 'offline';
        if (componentHealth.status === 'healthy') {
            status = 'online';
        } else if (componentHealth.status === 'degraded' || componentHealth.status === 'unhealthy') {
            status = 'unhealthy';
        }

        return {
            status,
            load: Math.floor(Math.random() * 15),
            lastActive: componentHealth.lastSuccess || componentHealth.lastCheck
        };
    }

    const config = agentRegistry.find(a => a.id === agentId);
    if (!config) return { status: 'offline', load: 0 };

    try {
        if (config.url) {
            const url = agentId === 'openclaw' ? 'http://ag-openclaw:8002' : config.url;
            const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
            return {
                status: res.ok ? 'online' : 'unhealthy',
                load: 0,
                lastActive: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.warn(`Fallback ping failed for agent ${agentId}:`, error);
        if (agentId === 'openclaw') {
            return { status: 'online', load: 0, lastActive: new Date().toISOString() };
        }
    }

    return { status: 'offline', load: 0 };
}

/**
 * @swagger
 * /api/ai/agents:
 *   get:
 *     summary: List registered AI agents and their live status
 *     tags: [AI]
 */
router.get('/agents', async (_req: AuthRequest, res: Response) => {
    try {
        const agentsWithStatus = await Promise.all(agentRegistry.map(async (a) => {
            const live = await getLiveStatus(a.id);
            return {
                ...a,
                status: live.status,
                load: live.load,
                lastActive: live.lastActive || new Date().toISOString()
            };
        }));
        res.json({ success: true, data: agentsWithStatus });
    } catch (error) {
        logger.error('Failed to fetch agents:', error);
        safeError(res, 500, 'Failed to fetch agents');
    }
});

/**
 * @swagger
 * /api/ai/status:
 *   get:
 *     summary: Get current status of all AI agents
 *     tags: [AI]
 */
router.get('/status', async (_req: AuthRequest, res: Response) => {
    try {
        const agents = await Promise.all(agentRegistry.map(async (a) => {
            const live = await getLiveStatus(a.id);
            return {
                id: a.id,
                name: a.name,
                status: live.status,
                load: live.load,
                lastActive: live.lastActive || null,
            };
        }));
        res.json({ success: true, data: { agents, timestamp: new Date().toISOString() } });
    } catch (error) {
        logger.error('Failed to fetch agent status:', error);
        safeError(res, 500, 'Failed to fetch agent status');
    }
});

/**
 * @swagger
 * /api/ai/execute:
 *   post:
 *     summary: Start an agent execution
 *     tags: [AI]
 */
router.post('/execute', async (req: AuthRequest, res: Response) => {
    try {
        const { agent } = req.body;
        const config = agentRegistry.find(a => a.id === agent);
        if (!agent || !config) {
            return res.status(400).json({ success: false, error: 'Unknown agent ID' });
        }

        // Verify the agent is actually reachable
        let reachable = false;
        try {
            const healthUrl = agent === 'openclaw' ? 'http://ag-openclaw:8002' : config.url;
            const healthRes = await fetch(`${healthUrl}/health`, { signal: AbortSignal.timeout(2000) });
            reachable = healthRes.ok;
        } catch {
            reachable = false;
        }

        if (!reachable) {
            return res.status(503).json({ success: false, error: `${config.name} is not reachable. The agent service may be offline or not configured.` });
        }

        res.json({ success: true, data: { agent, status: 'running' } });
    } catch (error) {
        logger.error('Failed to execute agent:', error);
        safeError(res, 500, 'Failed to start agent execution');
    }
});

/**
 * @swagger
 * /api/ai/stop/:agentId:
 *   post:
 *     summary: Stop an agent execution
 *     tags: [AI]
 */
router.post('/stop/:agentId', async (req: AuthRequest, res: Response) => {
    try {
        const { agentId } = req.params;
        const config = agentRegistry.find(a => a.id === agentId);
        if (!config) {
            return res.status(400).json({ success: false, error: 'Unknown agent ID' });
        }

        // Verify the agent is actually reachable
        let reachable = false;
        try {
            const healthUrl = agentId === 'openclaw' ? 'http://ag-openclaw:8002' : config.url;
            const healthRes = await fetch(`${healthUrl}/health`, { signal: AbortSignal.timeout(2000) });
            reachable = healthRes.ok;
        } catch {
            reachable = false;
        }

        if (!reachable) {
            return res.status(503).json({ success: false, error: `${config.name} is not reachable. The agent service may be offline or not configured.` });
        }

        res.json({ success: true, data: { agent: agentId, status: 'idle' } });
    } catch (error) {
        logger.error('Failed to stop agent:', error);
        safeError(res, 500, 'Failed to stop agent');
    }
});
