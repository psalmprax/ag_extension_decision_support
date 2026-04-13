import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import i18nUrlMiddleware, { i18nRouteHandler, restoreOriginalPath } from './middleware/i18nUrlMiddleware';
import { securityGate } from './middleware/securityGate';
import rateLimit from 'express-rate-limit';
import { setupSwagger } from './utils/swagger';
import { getPool } from './services/databaseService';
import { getCache } from './services/cacheService';
import { persistentMemory } from './services/persistentMemory';

// Routes
import authRoutes from './routes/auth';
import knowledgeRoutes from './routes/knowledge';
import chatbotRoutes from './routes/chatbot';
import reportingRoutes from './routes/reporting';
import analyticsRoutes from './routes/analytics';
import portfolioRoutes from './routes/portfolio';
import usersRoutes from './routes/users';
import farmersRoutes from './routes/farmers';
import visitsRoutes from './routes/visits';
import externalRoutes from './routes/external';
import languageRoutes from './routes/language';
import aiRoutes from './routes/ai';
import uploadRoutes from './routes/upload';
import notificationRoutes from './routes/notifications';
import smsRoutes from './routes/sms';
import billingRoutes from './routes/billing';
import contextMenuRoutes from './routes/contextMenus';
import { shareRouter, publicShareRouter } from './routes/shares';
import alertRoutes from './routes/alerts';
import supportRoutes from './routes/support';
// MCP router will be created dynamically to avoid path alias issues in production
import telemetryRoutes from './routes/telemetry';
import emailWorkflowRoutes from './routes/emailWorkflows';
import agentRoutes from './routes/agents';
import systemHealthRoutes from './routes/systemHealth';
import memoryRoutes from './routes/memories';
import diseaseRoutes from './routes/diseases';

const app: Application = express();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://images.unsplash.com", "https://*.ytimg.com"],
            "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
            "connect-src": ["'self'", "https://api.openai.com", "https://*.azure.com", "https://*.google.com"],
        },
    },
}));
app.use(compression());
const allowedOrigins = config.cors.origin.split(',').map(o => o.trim());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(limiter);

// Request timeout middleware - 30s timeout for all requests
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        logger.warn(`Request timeout: ${req.method} ${req.path}`);
        res.status(408).json({ success: false, error: 'Request timeout' });
    });
    next();
});

app.use(securityGate);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Setup Swagger
setupSwagger(app);

// Health check
const healthHandler = async (_req: Request, res: Response) => {
    let dbStatus = 'unknown';
    let cacheStatus = 'unknown';
    try {
        const pool = getPool();
        if (pool) {
            await pool.query('SELECT 1');
            dbStatus = 'connected';
        } else {
            dbStatus = 'not configured';
        }
    } catch (error) {
        logger.error('Database health check failed:', error);
        dbStatus = 'error';
    }
    try {
        const redis = getCache();
        if (redis && redis.isOpen) {
            cacheStatus = 'connected';
        } else {
            cacheStatus = 'not connected';
        }
    } catch (error) {
        logger.error('Cache health check failed:', error);
        cacheStatus = 'error';
    }
    const isHealthy = dbStatus === 'connected';
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        services: { database: dbStatus, cache: cacheStatus }
    });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/health/live', (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/health/ready', (_req: Request, res: Response) => res.json({ status: 'ready' }));

// API Routes with i18n support
app.use(i18nUrlMiddleware);
app.use(i18nRouteHandler);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);
app.use('/api/v1/chatbot', chatbotRoutes);
app.use('/api/v1/reporting', reportingRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/portfolio', portfolioRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/farmers', farmersRoutes);
app.use('/api/v1/visits', visitsRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/external', externalRoutes);
app.use('/api/v1/language', languageRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/sms', smsRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/context-menus', contextMenuRoutes);
app.use('/api/v1/shares', shareRouter);
app.use('/api/public/shares', publicShareRouter);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/ai/telemetry', telemetryRoutes);
app.use('/api/v1/email', emailWorkflowRoutes);
app.use('/api/v1/ai/agents', agentRoutes);
app.use('/api/v1/system/health', systemHealthRoutes);
app.use('/api/v1/ai/memories', memoryRoutes);
app.use('/api/v1/ai/diseases', diseaseRoutes);
// Create MCP router synchronously to ensure it loads properly
let mcpRouter: any = null;
try {
  // Import synchronously for Docker deployment
  const { createMCPRouter } = require('./services/mcpAdapter');
  mcpRouter = createMCPRouter();
} catch (error) {
  console.error('Failed to create MCP router:', error);
}

// MCP middleware wrapper - synchronous
app.use('/api/v1/mcp', (req, res, next) => {
  if (mcpRouter) {
    mcpRouter(req, res, next);
  } else {
    res.status(503).json({ error: 'MCP service not available' });
  }
});
app.use('/api/mcp', (req, res, next) => {
  if (mcpRouter) {
    mcpRouter(req, res, next);
  } else {
    res.status(503).json({ error: 'MCP service not available' });
  }
});

// Legacy redirects
app.use('/api/auth', authRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/language', languageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/shares', shareRouter);
app.use('/api/public/shares', publicShareRouter);
app.use('/api/support', supportRoutes);
app.use('/api/ai/telemetry', telemetryRoutes);
app.use('/api/email', emailWorkflowRoutes);
app.use('/api/ai/agents', agentRoutes);
app.use('/api/system/health', systemHealthRoutes);
app.use('/api/ai/memories', memoryRoutes);
app.use('/api/ai/diseases', diseaseRoutes);
app.use('/api/mcp', (req, res, next) => {
  if (mcpRouter) {
    mcpRouter(req, res, next);
  } else {
    res.status(503).json({ error: 'MCP service not available' });
  }
});
// Restore original path after routing
app.use(restoreOriginalPath);

app.get('/api/versions', (_req: Request, res: Response) => {
    res.json({
        current_version: 'v1',
        supported_versions: ['v1'],
        deprecated: [],
        docs: '/api-docs'
    });
});

app.use(errorHandler);
app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Not Found' }));

export default app;
