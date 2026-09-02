import { initTelemetry } from './utils/telemetry';
initTelemetry();

import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { config } from './config';
import { logger } from './utils/logger';
import { initializeSocketHandlers } from './services/socketService';
import { webrtcService } from './services/webrtcService';
import { initializeDatabase } from './services/databaseService';
import { initializeCache } from './services/cacheService';
import { AIProviderFactory } from './services/aiProvider/aiProvider';
import { VectorService } from './services/vectorService';
import { persistentMemory } from './services/persistentMemory';
import { credentialVault } from './services/security/credentialVault';
import { skillVetter } from './services/security/skillVetter';
import { agentOrchestrator } from './services/agentOrchestrator';
import { emailWorkflowService } from './services/emailWorkflowService';
import { agentTelemetry } from './services/agentTelemetry';
import { selfHealingService } from './services/selfHealing';
import * as Sentry from '@sentry/node';
import app from './app';
import { validateStartupConfiguration, logStartupWarnings, shouldProceedAtStartup } from './utils/startupValidation';

// Sentry error tracking
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: config.nodeEnv,
        tracesSampleRate: 1.0,
    });
    logger.info('Sentry error tracking initialized');
}

import './workers/emailWorker';
import './workers/alertWorker';
import './workers/ingestionWorker';
import './workers/outreachWorker';

const httpServer = createServer(app);

// Socket.IO setup
const isAllowedSocketOrigin = (origin?: string): boolean => {
    if (!origin || config.nodeEnv !== 'production') return true;
    const allowedOrigins = config.cors.origin.split(',').map(o => o.trim());
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return true;
    if (/^https?:\/\/(?:[a-zA-Z0-9-]+\.)*gpexts\.com(?::\d+)?$/i.test(origin)) return true;
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) return true;
    return false;
};

const io = new SocketServer(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (isAllowedSocketOrigin(origin)) {
                callback(null, true);
            } else {
                logger.warn(`Socket.IO: Rejected connection from origin: ${origin}`);
                callback(new Error('Not allowed by CORS'), false);
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
});

// Runs a startup step with uniform error handling: logs a success line on
// completion, or a failure line (warn-only for optional services) on error.
async function initializeStep(label: string, init: () => Promise<void> | void, warnOnly = false): Promise<void> {
    try {
        await init();
        logger.info(`${label} initialized`);
    } catch (error) {
        if (warnOnly) {
            logger.warn(`${label} not available:`, error);
        } else {
            logger.error(`Failed to initialize ${label}:`, error);
        }
    }
}

// Initialize services and start server
async function bootstrap() {
    // Run startup configuration validation
    const startupWarnings = validateStartupConfiguration();
    logStartupWarnings(startupWarnings);

    if (!shouldProceedAtStartup(startupWarnings)) {
        logger.error('Critical configuration issues detected. Server will start but some features may be unavailable.');
    }

    await initializeStep('database', () => initializeDatabase());
    await initializeStep('cache', () => initializeCache());

    // Attach Redis adapter to Socket.IO for multi-instance scaling
    await initializeStep('Socket.IO Redis adapter', async () => {
        const pubClient = createClient({ url: config.redis.url });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
    }, true);

    // Initialize Socket.IO handlers
    await initializeStep('WebRTC service', () => {
        initializeSocketHandlers(io);
        webrtcService.initialize(io);
    });

    await initializeStep('AI Provider Factory', () => AIProviderFactory.initialize());

    // Seed Knowledge Articles (async)
    await initializeStep('knowledge articles', async () => {
        const { seedKnowledgeArticles, seedKnowledgeArticlesData } = await import('./routes/knowledge');
        seedKnowledgeArticles().catch((err: unknown) =>
            logger.error('Failed to seed knowledge articles:', err)
        );

        // Seed Vector Knowledge Base (async)
        VectorService.seedKnowledge(seedKnowledgeArticlesData).catch(err =>
            logger.error('Failed to seed vector knowledge:', err)
        );
    });

    // Sync external knowledge sources (curated tropical articles — fast, no API calls)
    await initializeStep('knowledge sync orchestrator', async () => {
        const { KnowledgeSyncOrchestrator } = await import('./services/data/knowledgeSyncOrchestrator');
        KnowledgeSyncOrchestrator.syncLightweight().catch(err =>
            logger.error('Failed to sync lightweight knowledge sources:', err)
        );
    });

    // Bootstrap RAG v2 (chunking + knowledge graph)
    await initializeStep('RAG v2 service', async () => {
        const { RAGV2Service } = await import('./services/ragV2Service');
        RAGV2Service.bootstrap().catch(err =>
            logger.error('Failed to bootstrap RAG v2:', err)
        );
    });

    await initializeStep('persistent memory layer', () => persistentMemory.initialize());

    // Register internal tools as vetted in the skill vetter
    await initializeStep('internal tools', async () => {
        const { toolRegistry } = await import('./tools/registry');
        for (const tool of toolRegistry) {
            skillVetter.registerVettedSkill({
                name: tool.name,
                source: 'internal',
                version: '1.0.0',
                author: 'ag-extension-team',
                description: tool.description,
                permissions: [],
                dependencies: [],
                installDate: new Date().toISOString(),
                hash: skillVetter.computeHash(tool.description),
                trustScore: 95,
                riskLevel: 'low',
                vetted: true,
                vettedAt: new Date().toISOString(),
                flags: [],
            });
        }
    });

    // Seed credentials from environment into secure vault
    await initializeStep('credentials', () => {
        if (process.env.OPENAI_API_KEY) {
            credentialVault.storeCredential('openai_api_key', 'ai_provider', process.env.OPENAI_API_KEY, 90);
        }
        if (process.env.GROQ_API_KEY) {
            credentialVault.storeCredential('groq_api_key', 'ai_provider', process.env.GROQ_API_KEY, 90);
        }
        if (process.env.TAVILY_API_KEY) {
            credentialVault.storeCredential('tavily_api_key', 'search', process.env.TAVILY_API_KEY, 90);
        }
    });

    // Register agents in orchestrator
    await initializeStep('agents', () => {
        agentOrchestrator.registerAgent({
            agentId: 'agent-zero',
            name: 'Agent Zero',
            capabilities: ['farmer_outreach', 'data_collection', 'weather_monitoring', '*'],
            maxConcurrentTasks: 3,
        });
        agentOrchestrator.registerAgent({
            agentId: 'crew-ai',
            name: 'Crew AI',
            capabilities: ['market_analysis', 'disease_diagnosis', 'policy_research', '*'],
            maxConcurrentTasks: 5,
        });
        // OpenClaw agent - planned for future implementation
        agentOrchestrator.registerAgent({
            agentId: 'openclaw',
            name: 'OpenClaw',
            capabilities: ['bug_fixes', 'unit_testing', 'doc_gen', '*'],
            maxConcurrentTasks: 3,
        });
    });

    await initializeStep('email worker', async () => {
        const { startEmailWorker } = await import('./workers/emailWorker');
        startEmailWorker();
    }, true);
    await initializeStep('email workflow service', () => emailWorkflowService.initialize());
    await initializeStep('agent telemetry', () => agentTelemetry.initialize());
    await initializeStep('agent orchestrator loop', async () => {
        const { agentOrchestrator } = await import('./services/agentOrchestrator');
        agentOrchestrator.startWorkerLoop(Number(process.env.AGENT_WORKER_INTERVAL_MS || 5000));
    }, true);

    // Register components for self-healing monitoring
    await initializeStep('self-healing monitoring', () => {
        selfHealingService.registerComponent('ai-provider');
        selfHealingService.registerComponent('database');
        selfHealingService.registerComponent('cache');
        selfHealingService.registerComponent('agent-zero');
        selfHealingService.registerComponent('crew-ai');
        selfHealingService.registerComponent('openclaw');
        selfHealingService.startMonitoring(60000);
    });

    // Proactive seasonal advisory engine (env-gated)
    void (async () => {
        try {
            const { startAdvisoryScheduler } = await import('./workers/advisoryWorker');
            await startAdvisoryScheduler();
        } catch (error) {
            logger.error('Advisory scheduler startup failed:', error);
        }
    })();

    // Scheduled SMS dispatcher — drains `scheduled_sms` every 60s
    void (async () => {
        try {
            const { smsService } = await import('./services/smsService');
            const intervalMs = Number(process.env.SCHEDULED_SMS_POLL_MS || 60_000);
            setInterval(async () => {
                try {
                    const n = await smsService.processScheduledSMS();
                    if (n > 0) logger.info(`Scheduled SMS worker dispatched ${n} messages`);
                } catch (e) {
                    logger.warn('Scheduled SMS worker tick failed:', e);
                }
            }, intervalMs).unref?.();
            logger.info(`Scheduled SMS worker armed (poll=${intervalMs}ms)`);
        } catch (error) {
            logger.error('Scheduled SMS worker startup failed:', error);
        }
    })();

    // Start server
    try {
        httpServer.listen(config.port, '0.0.0.0', () => {
            logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        // Don't exit, try to start server anyway
        try {
            httpServer.listen(config.port, '0.0.0.0', () => {
                logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode (with errors)`);
            });
        } catch (serverError) {
            logger.error('Failed to start server even with minimal config:', serverError);
            process.exit(1);
        }
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
    try {
        const { stopAdvisoryScheduler } = await import('./workers/advisoryWorker');
        await stopAdvisoryScheduler();
    } catch {
        // scheduler may not have started; nothing to stop
    }
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
        // Close HTTP server
        httpServer.close(() => {
            logger.info('HTTP server closed');
        });
        
        // Close database connection
        const { closeDatabase } = await import('./services/databaseService');
        await closeDatabase();
        logger.info('Database connection closed');
        
        // Close cache connection
        const { closeCache } = await import('./services/cacheService');
        await closeCache();
        logger.info('Cache connection closed');
        
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
    bootstrap();
}

export { app, httpServer, io };
