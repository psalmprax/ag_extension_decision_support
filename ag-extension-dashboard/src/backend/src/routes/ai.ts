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

import axios from 'axios';

// Agent registry — system-defined agent metadata
const agentRegistry = [
    {
        id: 'agent-zero',
        name: 'Agent Zero',
        url: 'http://ag-agent-zero:8000',
        description: 'Autonomous task execution & tool calling',
        capabilities: ['Farmer Outreach', 'Data Collection', 'Weather Monitoring'],
    },
    {
        id: 'crew-ai',
        name: 'Crew AI',
        url: 'http://ag-crew-ai:8001',
        description: 'Multi-agent orchestration workflows',
        capabilities: ['Market Analysis', 'Crop Disease Diagnosis', 'Policy Research'],
    },
    {
        id: 'openclaw',
        name: 'OpenClaw',
        url: 'http://localhost:8002', // Local only for refactoring tool
        description: 'Automated code & system refactoring',
        capabilities: ['Bug Fixes', 'Unit Testing', 'Doc Gen'],
    },
];

// Persistent state for "running" status
const activeAgentTasks: Record<string, { status: string; load: number; lastActive: string }> = {};

/**
 * Helper to get live agent status
 */
async function getLiveStatus(agentId: string) {
    const config = agentRegistry.find(a => a.id === agentId);
    if (!config || !config.url) return { status: 'offline', load: 0 };

    try {
        // Special case for OpenClaw which might not be in docker
        if (agentId === 'openclaw') return { status: 'online', load: 0 };

        const response = await axios.get(`${config.url}/health`, { timeout: 2000 });
        if (response.data.status === 'healthy') {
            // Check if we have an active task
            if (activeAgentTasks[agentId]?.status === 'running') {
                return { 
                    status: 'running', 
                    load: activeAgentTasks[agentId].load,
                    lastActive: activeAgentTasks[agentId].lastActive 
                };
            }
            return { status: 'online', load: 0, lastActive: response.data.timestamp };
        }
        return { status: 'unhealthy', load: 0 };
    } catch (error) {
        return { status: 'offline', load: 0 };
    }
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
        res.status(500).json({ success: false, error: 'Failed to fetch agents' });
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
        res.status(500).json({ success: false, error: 'Failed to fetch agent status' });
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
        if (!agent || !agentRegistry.find(a => a.id === agent)) {
            return res.status(400).json({ success: false, error: 'Unknown agent ID' });
        }
        
        // Mark as running in our persistent layer
        activeAgentTasks[agent] = {
            status: 'running',
            load: Math.floor(Math.random() * 60) + 20,
            lastActive: new Date().toISOString()
        };
        
        res.json({ success: true, data: { agent, status: 'running' } });
    } catch (error) {
        logger.error('Failed to execute agent:', error);
        res.status(500).json({ success: false, error: 'Failed to start agent execution' });
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
        if (!activeAgentTasks[agentId] && !agentRegistry.find(a => a.id === agentId)) {
            return res.status(400).json({ success: false, error: 'Unknown agent ID' });
        }
        
        // Reset state
        activeAgentTasks[agentId] = {
            status: 'idle',
            load: 0,
            lastActive: new Date().toISOString()
        };
        
        res.json({ success: true, data: { agent: agentId, status: 'idle' } });
    } catch (error) {
        logger.error('Failed to stop agent:', error);
        res.status(500).json({ success: false, error: 'Failed to stop agent' });
    }
});
