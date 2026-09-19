import { initTelemetry } from './utils/telemetry';
initTelemetry();

import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { config } from './config';
import { logger } from './utils/logger';
import { resolveCorsOrigin } from './utils/corsOrigin';
import { initializeSocketHandlers } from './services/socketService';
import { setRealtimeServer } from './services/realtimeHub';
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
import { runIfLeader } from './services/leaderElection';
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
import './workers/notificationWorker';

const httpServer = createServer(app);

// Socket.IO setup
// Socket.IO origin checks run through the same hardened corsOrigin policy as
// HTTP CORS (exact-match + opt-in wildcards; localhost only outside prod).
// Sockets carry auth cookies with credentials:true, so this is CSRF-relevant.
const socketOriginPolicy = resolveCorsOrigin(
    config.cors.origin.split(',').map(o => o.trim()),
    config.nodeEnv,
);

const io = new SocketServer(httpServer, {
    cors: {
        origin: (origin, callback) => {
            socketOriginPolicy(origin, (err, allow) => {
                if (!allow) {
                    logger.warn(`Socket.IO: Rejected connection from origin: ${origin}`);
                    callback(new Error('Not allowed by CORS'), false);
                } else {
                    callback(null, true);
                }
            });
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
});

// Adapter pub/sub clients — retained so graceful shutdown can close them cleanly.
let adapterPubClient: ReturnType<typeof createClient> | null = null;
let adapterSubClient: ReturnType<typeof createClient> | null = null;

// Scheduled-SMS polling fallback timer (leader-gated); cleared on shutdown.
let smsPollTimer: NodeJS.Timeout | null = null;

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

async function initializeSocketAdapter() {
    adapterPubClient = createClient({ url: config.redis.url });
    adapterSubClient = adapterPubClient.duplicate();
    adapterPubClient.on('error', (err) => logger.warn('Socket.IO Redis adapter pub client error:', err instanceof Error ? err.message : err));
    adapterSubClient.on('error', (err) => logger.warn('Socket.IO Redis adapter sub client error:', err instanceof Error ? err.message : err));
    await Promise.all([adapterPubClient.connect(), adapterSubClient.connect()]);
    io.adapter(createAdapter(adapterPubClient, adapterSubClient));
}

async function bootstrapKnowledge() {
    try {
        const { seedKnowledgeArticles, seedKnowledgeArticlesData } = await import('./routes/knowledge');
        await seedKnowledgeArticles();
        await VectorService.seedKnowledge(seedKnowledgeArticlesData);

        const { KnowledgeSyncOrchestrator } = await import('./services/data/knowledgeSyncOrchestrator');
        await KnowledgeSyncOrchestrator.syncLightweight();

        // Anything inserted without a vector (legacy rows, plain-SQL paths) gets one now.
        // Drains fully (batched) so a large existing corpus is indexed in one boot,
        // not one batch per restart. Disable with EMBEDDING_BACKFILL_ON_BOOT=false.
        if (process.env.EMBEDDING_BACKFILL_ON_BOOT !== 'false') {
            const bf = await VectorService.backfillAllMissingEmbeddings(100);
            if (bf.remaining > 0) logger.warn(`Embedding backfill left ${bf.remaining} rows unindexed${bf.aborted ? ` — ${bf.aborted}` : ''}`);
        }

        const { RAGV2Service } = await import('./services/ragV2Service');
        await RAGV2Service.bootstrap();
        logger.info('Knowledge bootstrap complete');
    } catch (err) {
        logger.error('Knowledge bootstrap failed:', err);
    }
}

function seedCredentials() {
    if (process.env.OPENAI_API_KEY) {
        credentialVault.storeCredential('openai_api_key', 'ai_provider', process.env.OPENAI_API_KEY, 90);
    }
    if (process.env.GROQ_API_KEY) {
        credentialVault.storeCredential('groq_api_key', 'ai_provider', process.env.GROQ_API_KEY, 90);
    }
    if (process.env.TAVILY_API_KEY) {
        credentialVault.storeCredential('tavily_api_key', 'search', process.env.TAVILY_API_KEY, 90);
    }
}

async function startScheduledSms() {
    try {
        const { startScheduledSmsWorker } = await import('./workers/scheduledSmsWorker');
        startScheduledSmsWorker();
    } catch (error) {
        logger.error('Scheduled SMS BullMQ worker startup failed:', error);
    }
    try {
        const { smsService } = await import('./services/smsService');
        const intervalMs = Number(process.env.SCHEDULED_SMS_POLL_MS || 60_000);
        // Leader-gated: the BullMQ worker already delivers jobs once; this
        // polling fallback exists for Redis outages / pre-existing rows. Allowing
        // every replica to poll would double-send when BullMQ is healthy.
        smsPollTimer = setInterval(async () => {
            try {
                const ran = await runIfLeader('scheduled-sms-poller', () => smsService.processScheduledSMS());
                if (ran !== null && ran > 0) logger.info(`Scheduled SMS polling fallback dispatched ${ran} messages`);
            } catch (e) {
                logger.warn('Scheduled SMS polling tick failed:', e);
            }
        }, intervalMs);
        smsPollTimer.unref?.();
        logger.info(`Scheduled SMS polling fallback armed (poll=${intervalMs}ms, leader-gated)`);
    } catch (error) {
        logger.error('Scheduled SMS polling startup failed:', error);
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

    // Database is load-bearing: in production a failed init must crash the
    // process (fail-fast) rather than serve a zombie API that 500s everything.
    try {
        await initializeDatabase();
        logger.info('database initialized');
    } catch (error) {
        logger.error('Fatal: database initialization failed:', error);
        process.exit(1);
    }
    await initializeStep('cache', () => initializeCache());

    // Attach Redis adapter to Socket.IO for multi-instance scaling
    await initializeStep('Socket.IO Redis adapter', initializeSocketAdapter, true);

    // Initialize Socket.IO handlers
    await initializeStep('WebRTC service', () => {
        setRealtimeServer(io);
        initializeSocketHandlers(io);
        webrtcService.initialize(io);
    });

    await initializeStep('AI Provider Factory', () => AIProviderFactory.initialize());

    // Knowledge bootstrap runs in the background but *sequentially*: rows must exist
    // before embeddings are generated, embeddings must exist before RAG v2 chunks
    // them, and the seeders must not race each other on the same ids.
    await initializeStep('knowledge bootstrap (background)', async () => {
        void bootstrapKnowledge();
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
    await initializeStep('credentials', seedCredentials);

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
    });

    await initializeStep('email worker', async () => {
        const { startEmailWorker } = await import('./workers/emailWorker');
        startEmailWorker();
    }, true);
    await initializeStep('notification worker', async () => {
        const { startNotificationWorker } = await import('./workers/notificationWorker');
        startNotificationWorker();
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

    // Scheduled SMS dispatcher and leader-gated polling fallback.
    void startScheduledSms();

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

// Graceful shutdown handling.
// Ordering: stop ingesting new work → drain HTTP → release coordination
// (leadership) → close data-plane connections. A hard SHUTDOWN_TIMEOUT_MS cap
// guarantees the process always exits even if a step hangs.
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 20_000);

function withTimeout<T>(p: Promise<T>, label: string): Promise<void> {
    return Promise.race([
        p.then(() => undefined),
        new Promise<void>(resolve => setTimeout(() => {
            logger.warn(`Shutdown step '${label}' timed out after ${SHUTDOWN_TIMEOUT_MS}ms`);
            resolve();
        }, SHUTDOWN_TIMEOUT_MS).unref?.()),
    ]);
}

async function stopIntervalWorkers() {
    // 1. Stop all interval workers first — no new batches/ticks can start.
    try {
        const { stopAlertWorker } = await import('./workers/alertWorker');
        stopAlertWorker();
    } catch { /* worker may not have started */ }
    try {
        const { stopIngestionWorker } = await import('./workers/ingestionWorker');
        stopIngestionWorker();
    } catch { /* worker may not have started */ }
    try {
        const { outreachWorker } = await import('./workers/outreachWorker');
        outreachWorker.stop();
    } catch { /* worker may not have started */ }
    try {
        const { stopAdvisoryScheduler } = await import('./workers/advisoryWorker');
        await stopAdvisoryScheduler();
    } catch { /* scheduler may not have started */ }
    if (smsPollTimer) {
        clearInterval(smsPollTimer);
        smsPollTimer = null;
    }
    try {
        const { selfHealingService } = await import('./services/selfHealing');
        selfHealingService.stopMonitoring();
    } catch { /* monitoring may not have started */ }
}

async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    await stopIntervalWorkers();

    // 2. Stop accepting new HTTP connections and drain in-flight requests.
    await withTimeout(
        new Promise<void>(resolve => {
            httpServer.close(() => resolve());
            // Node ≥18.2: force-close idle keep-alive sockets so `close` fires
            // promptly instead of waiting out the keep-alive timeout.
            (httpServer as unknown as { closeIdleConnections?: () => void }).closeIdleConnections?.();
        }),
        'httpServer.close'
    );
    logger.info('HTTP server closed');

    // 3. Release leadership so another replica takes over immediately
    //    instead of waiting out the lease TTL.
    try {
        const { stopAll } = await import('./services/leaderElection');
        await withTimeout(stopAll(), 'leaderElection.stopAll');
    } catch { /* election may not have started */ }

    // 4. Close Socket.IO and the adapter pub/sub transport.
    try {
        await withTimeout(
            new Promise<void>((resolve, reject) => io.close(err => (err ? reject(err) : resolve()))),
            'io.close'
        );
    } catch { /* sockets may already be gone */ }
    for (const [label, client] of [['adapter pub', adapterPubClient], ['adapter sub', adapterSubClient]] as const) {
        if (client && client.isOpen) {
            try { await client.quit(); } catch { client.disconnect(); }
            logger.info(`Socket.IO Redis adapter ${label} client closed`);
        }
    }

    // 5. Close queue workers, then data-plane connections.
    try {
        const { closeQueueConnections } = await import('./queues/connection');
        await withTimeout(closeQueueConnections(), 'queues.close');
    } catch { /* queues may not have started */ }
    try {
        const { closeDatabase } = await import('./services/databaseService');
        await withTimeout(closeDatabase(), 'database.close');
        logger.info('Database connection closed');
    } catch { /* DB may not have been initialized */ }
    try {
        const { closeCache } = await import('./services/cacheService');
        await withTimeout(closeCache(), 'cache.close');
        logger.info('Cache connection closed');
    } catch { /* cache may not have been initialized */ }

    process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
// Belt-and-braces: a second signal means "stop waiting", exit immediately.
process.on('SIGUSR2', () => {
    logger.warn('Forcing immediate exit (second shutdown signal)');
    process.exit(1);
});

if (process.env.NODE_ENV !== 'test') {
    bootstrap();
}

export { app, httpServer, io };
