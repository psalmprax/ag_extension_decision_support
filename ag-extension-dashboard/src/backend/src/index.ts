import { initTelemetry } from './utils/telemetry';
initTelemetry();

import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
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

const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketServer(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // In production, we allow the configured origin OR if the origin is missing (compatible clients)
            // or if it's the server's own IP. For now, we'll be permissive in dev and use config in prod.
            if (!origin || config.nodeEnv !== 'production') {
                callback(null, true);
                return;
            }
            
            const allowedOrigins = config.cors.origin.split(',').map(o => o.trim());
            if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
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

// Initialize services and start server
async function bootstrap() {
    try {
        // Run startup configuration validation
        const startupWarnings = validateStartupConfiguration();
        logStartupWarnings(startupWarnings);

        if (!shouldProceedAtStartup(startupWarnings)) {
            logger.error('Critical configuration issues detected. Server will start but some features may be unavailable.');
        }

        // Initialize database
        try {
            await initializeDatabase();
            logger.info('Database initialized');
        } catch (error) {
            logger.error('Failed to initialize database, continuing without:', error);
        }

        // Initialize cache
        try {
            await initializeCache();
            logger.info('Cache initialized');
        } catch (error) {
            logger.error('Failed to initialize cache, continuing without:', error);
        }

        // Initialize Socket.IO handlers
        try {
            initializeSocketHandlers(io);
            webrtcService.initialize(io);
            logger.info('WebRTC service initialized');
        } catch (error) {
            logger.error('Failed to initialize WebRTC service:', error);
        }

        // Initialize AI Provider Factory
        try {
            AIProviderFactory.initialize();
            logger.info('AI Provider Factory initialized');
        } catch (error) {
            logger.error('Failed to initialize AI Provider Factory:', error);
        }

        // Seed Knowledge Articles (async)
        try {
            const { seedKnowledgeArticles, mockKnowledgeArticles } = await import('./routes/knowledge');
            seedKnowledgeArticles().catch(err =>
                logger.error('Failed to seed knowledge articles:', err)
            );

            // Seed Vector Knowledge Base (async)
            VectorService.seedKnowledge(mockKnowledgeArticles).catch(err =>
                logger.error('Failed to seed vector knowledge:', err)
            );
        } catch (error) {
            logger.error('Failed to import knowledge routes:', error);
        }

        // Initialize persistent memory layer
        try {
            await persistentMemory.initialize();
            logger.info('Persistent memory layer initialized');
        } catch (error) {
            logger.error('Failed to initialize persistent memory:', error);
        }

        // Register internal tools as vetted in the skill vetter
        try {
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
            logger.info(`${toolRegistry.length} internal tools registered as vetted`);
        } catch (error) {
            logger.error('Failed to register internal tools:', error);
        }

        // Seed credentials from environment into secure vault
        try {
            if (process.env.OPENAI_API_KEY) {
                credentialVault.storeCredential('openai_api_key', 'ai_provider', process.env.OPENAI_API_KEY, 90);
            }
            if (process.env.GROQ_API_KEY) {
                credentialVault.storeCredential('groq_api_key', 'ai_provider', process.env.GROQ_API_KEY, 90);
            }
            if (process.env.TAVILY_API_KEY) {
                credentialVault.storeCredential('tavily_api_key', 'search', process.env.TAVILY_API_KEY, 90);
            }
            logger.info('Credentials migrated to secure vault');
        } catch (error) {
            logger.error('Failed to migrate credentials:', error);
        }

        // Register agents in orchestrator
        try {
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
            logger.info('Agents registered in orchestrator');
        } catch (error) {
            logger.error('Failed to register agents:', error);
        }

        // Initialize email workflow service
        try {
            await emailWorkflowService.initialize();
            logger.info('Email workflow service initialized');
        } catch (error) {
            logger.error('Failed to initialize email workflow service:', error);
        }

        // Initialize agent telemetry
        try {
            await agentTelemetry.initialize();
            logger.info('Agent telemetry initialized');
        } catch (error) {
            logger.error('Failed to initialize agent telemetry:', error);
        }

        // Register components for self-healing monitoring
        try {
            selfHealingService.registerComponent('ai-provider');
            selfHealingService.registerComponent('database');
            selfHealingService.registerComponent('cache');
            selfHealingService.registerComponent('agent-zero');
            selfHealingService.registerComponent('crew-ai');
            selfHealingService.registerComponent('openclaw');
            selfHealingService.startMonitoring(60000);
            logger.info('Self-healing monitoring started');
        } catch (error) {
            logger.error('Failed to start self-healing monitoring:', error);
        }

        // Start server
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
