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
import { safeError } from '@/utils/safeResponse';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

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
];

/**
 * Helper to get live agent status from actual AI Providers
 */
type AgentLiveStatus = {
    status: 'online' | 'unhealthy' | 'offline';
    load: number;
    lastActive?: string;
};

function statusFromHealth(status: string): AgentLiveStatus['status'] {
    if (status === 'healthy') return 'online';
    if (status === 'degraded' || status === 'unhealthy') return 'unhealthy';
    return 'offline';
}

async function pingAgent(config: (typeof agentRegistry)[number]): Promise<AgentLiveStatus> {
    try {
        const response = await fetch(`${config.url}/health`, { signal: AbortSignal.timeout(1000) });
        return { status: response.ok ? 'online' : 'unhealthy', load: 0, lastActive: new Date().toISOString() };
    } catch (error) {
        logger.warn(`Agent health check failed for ${config.id}:`, error);
        return { status: 'offline', load: 0 };
    }
}

function unreachableAgentResponse(config: (typeof agentRegistry)[number]): { status: 503; body: { success: false; error: string } } {
    return {
        status: 503,
        body: {
            success: false,
            error: `${config.name} is not reachable. The agent service may be offline or not configured.`,
        },
    };
}

async function getLiveStatus(agentId: string): Promise<AgentLiveStatus> {
    const componentHealth = selfHealingService.getHealthStatus().get(agentId);
    if (componentHealth) {
        return {
            status: statusFromHealth(componentHealth.status),
            load: 0,
            lastActive: componentHealth.lastSuccess || componentHealth.lastCheck,
        };
    }

    const config = agentRegistry.find(agent => agent.id === agentId);
    return config ? pingAgent(config) : { status: 'offline', load: 0 };
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

type AgentControl = 'execute' | 'stop';

async function handleAgentControl(
    agentId: string | undefined,
    control: AgentControl,
    res: Response,
    options: { mode?: unknown } = {},
): Promise<void> {
    const config = agentRegistry.find(agent => agent.id === agentId);
    if (!config) {
        res.status(400).json({ success: false, error: 'Unknown agent ID' });
        return;
    }

    const live = await pingAgent(config);
    if (live.status !== 'online') {
        const unavailable = unreachableAgentResponse(config);
        res.status(unavailable.status).json(unavailable.body);
        return;
    }

    if (control === 'execute') {
        try {
            const { agentOrchestrator } = await import('@/services/agentOrchestrator');
            const task = await agentOrchestrator.dispatchTask({
                agentId: config.id,
                type: 'ai.execute',
                payload: {
                    triggeredBy: 'api/ai/execute',
                    at: new Date().toISOString(),
                    mode: ['supervised', 'autonomous', 'edge'].includes(String(options.mode)) ? String(options.mode) : 'supervised',
                },
                priority: 'medium',
                maxRetries: 2,
            });
            // Kick the worker loop once (best-effort)
            agentOrchestrator.executeNext().catch(() => {});
            res.json({ success: true, data: task, note: `Task queued for ${config.name} via orchestrator` });
            return;
        } catch (e) {
            logger.warn('Orchestrator dispatch on /ai/execute failed, falling back to 501:', e);
        }
    }

    if (control === 'stop') {
        try {
            const { agentOrchestrator } = await import('@/services/agentOrchestrator');
            const result = await agentOrchestrator.stopAgentTasks(config.id);
            res.json({ success: true, data: result, note: `Stopped ${result.stopped} running tasks, removed ${result.queued} queued tasks for ${config.name}` });
            return;
        } catch (e) {
            logger.warn('Orchestrator stop on /ai/stop failed:', e);
        }
    }

    const unavailableCode = {
        execute: 'AGENT_EXECUTION_NOT_WIRED',
        stop: 'AGENT_STOP_NOT_WIRED',
    } as const;
    const controlName = { execute: 'task dispatch', stop: 'stop control' }[control];
    res.status(501).json({
        success: false,
        errorCode: unavailableCode[control],
        error: `${config.name} is reachable, but ${controlName} is not configured for this control plane.`,
    });
}

/**
 * @swagger
 * /api/ai/execute:
 *   post:
 *     summary: Start an agent execution
 *     tags: [AI]
 */
router.post('/execute', async (req: AuthRequest, res: Response) => {
    try {
        await handleAgentControl(req.body?.agent, 'execute', res, { mode: req.body?.mode });
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
        await handleAgentControl(req.params.agentId, 'stop', res);
    } catch (error) {
        logger.error('Failed to stop agent:', error);
        safeError(res, 500, 'Failed to stop agent');
    }
});

export default router;
