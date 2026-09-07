import { Router, Response } from 'express';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/authorize';
import { selfHealingService } from '@/services/selfHealing';
import { safeError } from '@/utils/safeResponse';

const router = Router();

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
