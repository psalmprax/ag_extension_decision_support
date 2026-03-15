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
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
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

        // Seed Vector Knowledge Base (async)
        const { mockKnowledgeArticles } = await import('./routes/knowledge');
        VectorService.seedKnowledge(mockKnowledgeArticles).catch(err =>
            logger.error('Failed to seed vector knowledge:', err)
        );

        // Start server
        httpServer.listen(config.port, () => {
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
