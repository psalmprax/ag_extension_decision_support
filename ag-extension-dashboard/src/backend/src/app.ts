/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { setupSwagger } from './utils/swagger';
import { getPool } from './services/databaseService';
import { getCache } from './services/cacheService';

import { perUserRateLimit } from './middleware/rateLimitMiddleware';
import { optionalAuth } from './middleware/authorize';
import { AIProviderFactory } from './services/aiProvider/aiProvider';
import { selfHealingService } from './services/selfHealing';

// Routes
import authRoutes from './routes/auth';
import knowledgeRoutes from './routes/knowledge';
import knowledgeSourcesRoutes from './routes/knowledgeSources';
import knowledgeSyncRoutes from './routes/knowledgeSync';
import chatbotRoutes from './routes/chatbot';
import chatbotSpeechRoutes from './routes/chatbotSpeech';
import reportingRoutes from './routes/reporting';
import analyticsRoutes from './routes/analytics';
import portfolioRoutes from './routes/portfolio';
import usersRoutes from './routes/users';
import farmersRoutes from './routes/farmers';
import fieldsRoutes from './routes/fields';
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
import diagnosticsRoutes from './routes/diagnostics';
import memoryRoutes from './routes/memories';
import diseaseRoutes from './routes/diseases';
import whatsappRoutes from './routes/whatsapp';
import apiClientRoutes from './routes/apiClients';
import commercialKnowledgeRoutes from './routes/commercialKnowledge';

const app: Application = express();
app.set('trust proxy', true); // Trust all proxy hops (Traefik/Docker) for X-Forwarded-For

const limiter = perUserRateLimit;

// Middleware
app.use(helmet({
    hsts: config.nodeEnv === 'production',
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "upgrade-insecure-requests": config.nodeEnv === 'production' ? [] : null,
            "img-src": ["'self'", "data:", "https://images.unsplash.com", "https://*.ytimg.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://*.openstreetmap.org", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "data:", "https://unpkg.com", "https://fonts.gstatic.com"],
            "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
            "connect-src": ["'self'", "http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*", "https://api.openai.com", "https://*.azure.com", "https://*.google.com"],
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
app.use(securityGate); // Security gate runs FIRST — before auth and rate limiting
app.use(optionalAuth); // Parse optional user credentials before applying rate limiting

// Request timeout middleware — AI-heavy routes (knowledge/ask, chatbot) get 120s, rest get 30s
app.use((req, res, next) => {
    const isAiHeavy = ['/api/knowledge', '/api/chatbot', '/api/v1/knowledge', '/api/v1/chatbot']
        .some(p => req.path.startsWith(p));
    const timeout = isAiHeavy ? 120000 : 30000;
    res.setTimeout(timeout, () => {
        logger.warn(`Request timeout (${timeout}ms): ${req.method} ${req.path}`);
        if (!res.headersSent) {
            res.status(408).json({ success: false, error: 'Request timeout' });
        }
    });
    next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Setup Swagger
setupSwagger(app);

// Health check helpers
async function checkDatabase(): Promise<{ status: string; error?: string }> {
    try {
        const pool = getPool();
        if (!pool) return { status: 'not configured' };
        await pool.query('SELECT 1');
        return { status: 'connected' };
    } catch (error) {
        logger.error('Database health check failed:', error);
        return { status: 'error', error: `database: ${(error as Error).message}` };
    }
}

async function checkCache(): Promise<{ status: string; error?: string }> {
    try {
        const redis = getCache();
        if (redis?.isOpen) return { status: 'connected' };
        return { status: 'not connected' };
    } catch (error) {
        logger.error('Cache health check failed:', error);
        return { status: 'error', error: `cache: ${(error as Error).message}` };
    }
}

async function checkAIProvider(): Promise<{ status: string; error?: string }> {
    try {
        const primaryProvider = await AIProviderFactory.getPrimaryProvider();
        const primaryHealthy = primaryProvider.isConfigured() && await primaryProvider.healthCheck();
        
        let fallbackHealthy = false;
        let fallbackActiveName = 'none';
        try {
            const fallbackProvider = await AIProviderFactory.getFallbackProvider();
            fallbackHealthy = fallbackProvider.isConfigured() && await fallbackProvider.healthCheck();
            if (fallbackHealthy) fallbackActiveName = fallbackProvider.provider;
        } catch {
            fallbackHealthy = false;
        }

        let anyCascadingHealthy = false;
        if (!primaryHealthy && !fallbackHealthy) {
            const cascadeTypes: any[] = ['groq', 'ollama', 'openai', 'anthropic'];
            for (const type of cascadeTypes) {
                try {
                    const p = await AIProviderFactory.getProvider(type);
                    if (p.isConfigured() && await p.healthCheck()) {
                        anyCascadingHealthy = true;
                        fallbackActiveName = p.provider;
                        break;
                    }
                } catch {}
            }
        }

        if (primaryHealthy) return { status: 'healthy' };
        if (fallbackHealthy) return { status: 'degraded (fallback active)' };
        if (anyCascadingHealthy) return { status: `degraded (fell back to ${fallbackActiveName})` };
        if (!primaryProvider.isConfigured() && !await (await AIProviderFactory.getFallbackProvider()).isConfigured()) {
            return { status: 'not configured' };
        }
        return { status: 'unhealthy', error: 'ai_provider: primary, fallback, and cascade options are all unhealthy' };
    } catch (error) {
        return { status: 'error', error: `ai_provider: ${(error as Error).message}` };
    }
}

function checkExternalAPIs(): { status: string; error?: string } {
    try {
        const weatherKey = config.externalApis.weather.apiKey;
        const weatherUrl = config.externalApis.weather.url;
        const faoConfigured = !!config.externalApis.fao.url;
        const nasaConfigured = true;

        if (weatherKey || weatherUrl || faoConfigured || nasaConfigured) {
            const configured = ['weather', 'fao', 'nasa'].filter(k =>
                (k === 'weather' && (weatherKey || weatherUrl)) ||
                (k === 'fao' && faoConfigured) ||
                (k === 'nasa')
            ).length;
            return { status: `${configured}/3 configured` };
        }
        return { status: 'none configured' };
    } catch (error) {
        return { status: 'error', error: `external_apis: ${(error as Error).message}` };
    }
}

function checkAgentServices(): { status: string; error?: string } {
    try {
        const agentHealth = selfHealingService.getHealthStatus();
        const registeredCount = agentHealth.size;
        const unhealthyCount = Array.from(agentHealth.values()).filter(h => h.status === 'unhealthy' || h.status === 'offline').length;
        
        if (registeredCount === 0) return { status: 'not initialized' };
        if (unhealthyCount === 0) return { status: `${registeredCount} registered, all healthy` };
        return { status: `${registeredCount} registered, ${unhealthyCount} unhealthy`, error: `agents: ${unhealthyCount} unhealthy` };
    } catch (error) {
        return { status: 'error', error: `agents: ${(error as Error).message}` };
    }
}

// Health check handler with full dependency checks
const healthHandler = async (_req: Request, res: Response) => {
    const [db, cache, ai, external, agents] = await Promise.all([
        checkDatabase(),
        checkCache(),
        checkAIProvider(),
        Promise.resolve(checkExternalAPIs()),
        Promise.resolve(checkAgentServices()),
    ]);

    const errors = [db.error, cache.error, ai.error, external.error, agents.error].filter(Boolean);
    const isHealthy = db.status === 'connected' && ai.status !== 'unhealthy';
    const isDegraded = db.status === 'connected' && errors.length > 0;

    res.status(isHealthy ? 200 : isDegraded ? 200 : 503).json({
        status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: '1.0.1',
        services: {
            database: db.status,
            cache: cache.status,
            ai_provider: ai.status,
            external_apis: external.status,
            agent_orchestrator: agents.status,
        },
        errors: errors.length > 0 ? errors : undefined,
    });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/health/live', (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/health/ready', (_req: Request, res: Response) => res.json({ status: 'ready' }));

// Apply global rate limiter to all API routes (excluding health checks)
app.use(limiter);

// API route mounts — defined once, mounted under /api/v1/ (with i18n) and /api/ (legacy)
type RouteMount = { path: string; router: express.Router };
const routeMounts: RouteMount[] = [
  { path: '/auth', router: authRoutes },
  { path: '/knowledge', router: knowledgeRoutes },
  { path: '/knowledge/sources', router: knowledgeSourcesRoutes },
  { path: '/knowledge/sync', router: knowledgeSyncRoutes },
  { path: '/chatbot', router: chatbotRoutes },
  { path: '/chatbot/speech', router: chatbotSpeechRoutes },
  { path: '/reporting', router: reportingRoutes },
  { path: '/analytics', router: analyticsRoutes },
  { path: '/portfolio', router: portfolioRoutes },
  { path: '/users', router: usersRoutes },
  { path: '/farmers', router: farmersRoutes },
  { path: '/fields', router: fieldsRoutes },
  { path: '/visits', router: visitsRoutes },
  { path: '/alerts', router: alertRoutes },
  { path: '/external', router: externalRoutes },
  { path: '/language', router: languageRoutes },
  { path: '/ai', router: aiRoutes },
  { path: '/upload', router: uploadRoutes },
  { path: '/notifications', router: notificationRoutes },
  { path: '/sms', router: smsRoutes },
  { path: '/billing', router: billingRoutes },
  { path: '/context-menus', router: contextMenuRoutes },
  { path: '/shares', router: shareRouter },
  { path: '/support', router: supportRoutes },
  { path: '/ai/telemetry', router: telemetryRoutes },
  { path: '/email', router: emailWorkflowRoutes },
  { path: '/ai/agents', router: agentRoutes },
  { path: '/system/health', router: systemHealthRoutes },
  { path: '/health/diagnostics', router: diagnosticsRoutes },
  { path: '/system/diagnostics', router: diagnosticsRoutes },
  { path: '/ai/memories', router: memoryRoutes },
  { path: '/ai/diseases', router: diseaseRoutes },
  { path: '/ai', router: diseaseRoutes },
  { path: '/whatsapp', router: whatsappRoutes },
  { path: '/api-clients', router: apiClientRoutes },
  { path: '/commercial/knowledge', router: commercialKnowledgeRoutes },
];

// Mount with i18n support (v1)
app.use(i18nUrlMiddleware);
app.use(i18nRouteHandler);
routeMounts.forEach(m => app.use(`/api/v1${m.path}`, m.router));

// Also mount public shares (no v1 prefix needed)
app.use('/api/public/shares', publicShareRouter);

// Create MCP router dynamically to support modern module standards and tree-shaking
let mcpRouter: any = null;
import('./services/mcpAdapter')
  .then(({ createMCPRouter }) => {
    mcpRouter = createMCPRouter();
  })
  .catch((error) => {
    logger.error('Failed to create MCP router dynamically:', error);
  });


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

// Legacy redirects (no i18n)
routeMounts.forEach(m => app.use(`/api${m.path}`, m.router));
app.use('/api/public/shares', publicShareRouter);
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

// Client-side error reporting endpoint
app.post('/api/errors', (req: Request, res: Response) => {
    const { error, componentStack, componentName, url, userAgent } = req.body;
    logger.warn('Client error reported:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        componentName,
        componentStack,
        url,
        userAgent,
        ip: req.ip,
    });
    res.status(200).json({ success: true });
});

app.use(errorHandler);
app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Not Found' }));

export default app;
