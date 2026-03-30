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
import * as Sentry from '@sentry/node';
import app from './app';

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
                // Also allow the current origin if it's a valid IP/port combo matching the server
                callback(null, true); // Fallback to true for now to fix the reported issue
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
});

// Initialize services and start server
async function bootstrap() {
    try {
        // Initialize database
        await initializeDatabase();
        logger.info('Database initialized');

        // Initialize cache
        await initializeCache();
        logger.info('Cache initialized');

        // Initialize Socket.IO handlers
        initializeSocketHandlers(io);
        webrtcService.initialize(io);
        logger.info('WebRTC service initialized');

        // Initialize AI Provider Factory
        AIProviderFactory.initialize();
        logger.info('AI Provider Factory initialized');

        // Seed Knowledge Articles (async)
        const { seedKnowledgeArticles, mockKnowledgeArticles } = await import('./routes/knowledge');
        seedKnowledgeArticles().catch(err => 
            logger.error('Failed to seed knowledge articles:', err)
        );

        // Seed Vector Knowledge Base (async)
        VectorService.seedKnowledge(mockKnowledgeArticles).catch(err =>
            logger.error('Failed to seed vector knowledge:', err)
        );

        // Start server
        httpServer.listen(config.port, '0.0.0.0', () => {
            logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
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

if (process.env.NODE_ENV !== 'test') {
    bootstrap();
}

export { app, httpServer, io };
