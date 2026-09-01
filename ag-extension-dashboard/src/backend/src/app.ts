import express, { Application, Request, Response, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './utils/logger';
import { resolveCorsOrigin } from './utils/corsOrigin';
import { errorHandler } from './middleware/errorHandler';
import i18nUrlMiddleware, { i18nRouteHandler, restoreOriginalPath } from './middleware/i18nUrlMiddleware';
import { securityGate } from './middleware/securityGate';
import { setupSwagger } from './utils/swagger';
import { getPool } from './services/databaseService';
import { getCache } from './services/cacheService';
import { setRequestUserId } from './services/requestContext';

import { correlationIdMiddleware } from './middleware/correlationIdMiddleware';
import { perUserRateLimit } from './middleware/rateLimitMiddleware';
import { optionalAuth } from './middleware/authorize';
import { idempotencyMiddleware } from './middleware/idempotencyMiddleware';
import { AIProviderFactory } from './services/aiProvider/aiProvider';
import { AI_CASCADE_FALLBACK } from './services/aiProvider/cascade';
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
import efficacyRoutes from './routes/efficacy';
import advisoriesRoutes from './routes/advisories';
import outbreaksRoutes from './routes/outbreaks';
import fieldIntelligenceRoutes from './routes/fieldIntelligence';
import externalRoutes from './routes/external';
import languageRoutes from './routes/language';
import aiRoutes from './routes/ai';
import uploadRoutes from './routes/upload';
import dataRightsRoutes from './routes/dataRights';
import organizationsRoutes from './routes/organizations';
import recommendationReviewRoutes from './routes/recommendationReviews';
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
import canadianServicesRoutes from './routes/canadianServices';
import channelsRoutes from './routes/channels';
import campaignsRoutes from './routes/autonomousCampaigns';
import verificationFraudRoutes from './routes/verificationFraud';
import activityTriageRoutes from './routes/activityTriage';

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
            "frame-ancestors": ["'self'"],
            "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
            "connect-src": config.nodeEnv === 'production'
                ? ["'self'", "https://api.openai.com", "https://*.azure.com", "https://*.google.com"]
                : ["'self'", "http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*", "https://api.openai.com", "https://*.azure.com", "https://*.google.com"],
        },
    },
}));
app.use(correlationIdMiddleware);
app.use(compression());
const allowedOrigins = config.cors.origin.split(',').map(o => o.trim());
app.use(cors({ origin: resolveCorsOrigin(allowedOrigins), credentials: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message) } }));
app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(securityGate); // Security gate runs FIRST — before auth and rate limiting
app.use(optionalAuth); // Parse optional user credentials before applying rate limiting
app.use((req, _res, next) => {
    setRequestUserId(req.user?.userId);
    next();
});
app.use(idempotencyMiddleware);

// Request timeout middleware — AI-heavy routes (knowledge/ask, chatbot) get 120s, rest get 30s
app.use((req, res, next) => {
    const isAiHeavy = ['/api/knowledge', '/api/chatbot', '/api/v1/knowledge', '/api/v1/chatbot']
        .some(p => req.path.startsWith(p));
    const timeout = isAiHeavy ? 300000 : 30000;
    res.setTimeout(timeout, () => {
        logger.warn(`Request timeout (${timeout}ms): ${req.method} ${req.path}`);
        if (!res.headersSent) {
            res.status(408).json({ success: false, error: 'Request timeout' });
        }
    });
    next();
});

// Uploaded files are served through the authenticated upload route below;
// never expose the storage directory as a public static path.

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

async function checkFallbackProvider(): Promise<{ healthy: boolean; name: string }> {
    try {
        const fallbackProvider = await AIProviderFactory.getFallbackProvider();
        const healthy = fallbackProvider.isConfigured() && await fallbackProvider.healthCheck();
        return { healthy, name: healthy ? fallbackProvider.provider : 'none' };
    } catch (error) {
        logger.debug('Fallback AI provider health check failed:', error);
        return { healthy: false, name: 'none' };
    }
}

async function checkCascadeProviders(): Promise<{ healthy: boolean; name: string }> {
    // See AI_CASCADE_FALLBACK in services/aiProvider/cascade.ts for order rationale.
    for (const type of AI_CASCADE_FALLBACK) {
        try {
            const p = await AIProviderFactory.getProvider(type);
            if (p.isConfigured() && await p.healthCheck()) {
                return { healthy: true, name: p.provider };
            }
        } catch (error) {
            logger.debug(`Cascade AI provider ${type} health check failed:`, error);
        }
    }
    return { healthy: false, name: 'none' };
}

async function checkPrimaryProviderHealth(): Promise<{ healthy: boolean; configured: boolean; name: string; error?: string }> {
    const primaryProvider = await AIProviderFactory.getPrimaryProvider();
    const configured = primaryProvider.isConfigured();
    const healthy = configured && await primaryProvider.healthCheck();
    // Surface *why* the primary is unhealthy so /api/health is actionable:
    // missing key, invalid key (401), model access (404), quota (429), etc.
    const error = !healthy
        ? configured
            ? primaryProvider.getLastHealthError?.() || 'health check failed'
            : 'not configured (missing API key)'
        : undefined;
    return { healthy, configured, name: primaryProvider.provider, error };
}

async function checkAIProvider(): Promise<{ status: string; error?: string }> {
    try {
        const primary = await checkPrimaryProviderHealth();

        const fallback = await checkFallbackProvider();
        let fallbackActiveName = fallback.name;

        let anyCascadingHealthy = false;
        if (!primary.healthy && !fallback.healthy) {
            const cascade = await checkCascadeProviders();
            anyCascadingHealthy = cascade.healthy;
            if (cascade.healthy) fallbackActiveName = cascade.name;
        }

        if (primary.healthy) return { status: 'healthy' };
        if (fallback.healthy) {
            return {
                status: `degraded (fallback active) — primary ${primary.name}: ${primary.error}`,
                error: `ai_provider: primary ${primary.name} unhealthy — ${primary.error}`,
            };
        }
        if (anyCascadingHealthy) return { status: `degraded (fell back to ${fallbackActiveName})` };
        if (!primary.configured && !(await AIProviderFactory.getFallbackProvider()).isConfigured()) {
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

// Agents registered for orchestration but intentionally not yet implemented as a
// service (e.g. OpenClaw is "planned for future implementation"). They are kept in
// the registry so the UI can show them, but a permanently-absent service must not
// flag the production health check as unhealthy.
const PLANNED_AGENTS = new Set(['openclaw']);

function checkAgentServices(): { status: string; error?: string } {
    try {
        const agentHealth = selfHealingService.getHealthStatus();
        const registeredCount = agentHealth.size;
        const unhealthyCount = Array.from(agentHealth.values()).filter(h =>
            (h.status === 'unhealthy' || h.status === 'offline') && !PLANNED_AGENTS.has(h.component)
        ).length;

        if (registeredCount === 0) return { status: 'not initialized' };
        if (unhealthyCount === 0) return { status: `${registeredCount} registered, all healthy` };
        return { status: `${registeredCount} registered, ${unhealthyCount} unhealthy`, error: `agents: ${unhealthyCount} unhealthy` };
    } catch (error) {
        return { status: 'error', error: `agents: ${(error as Error).message}` };
    }
}

// Health check warm-up window: tolerate DB-still-warming for the first N seconds of
// process lifetime so /api/health doesn't return 503 during Prisma pool cold-start.
// After the window closes the original strict logic takes over so a real DB outage
// is still surfaced as 503.
const HEALTH_WARMUP_WINDOW_MS = 60_000;
const PROCESS_START_TIME = Date.now();

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'healthy (warmup)' | 'starting (warmup)';

// Warm-up window: the DB dependency is tolerated (Prisma pool cold-start can
// outlast a single curl probe). The AI provider doesn't share this cold-start
// path, so it is still gated on during warmup.
function resolveHealthStatus(opts: {
    dbOk: boolean;
    aiOk: boolean;
    errors: string[];
    inWarmup: boolean;
}): { statusCode: number; statusText: HealthStatus } {
    const { dbOk, aiOk, errors, inWarmup } = opts;

    if (inWarmup) {
        if (!aiOk) return { statusCode: 503, statusText: 'unhealthy' };
        if (dbOk && errors.length === 0) return { statusCode: 200, statusText: 'healthy (warmup)' };
        return { statusCode: 200, statusText: 'starting (warmup)' };
    }

    // Strict post-warmup behavior -- original logic verbatim.
    const isHealthyStrict = dbOk && aiOk;
    const isDegradedStrict = dbOk && errors.length > 0;
    return {
        statusCode: isHealthyStrict || isDegradedStrict ? 200 : 503,
        statusText: isHealthyStrict ? 'healthy' : isDegradedStrict ? 'degraded' : 'unhealthy',
    };
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

    const errors = [db.error, cache.error, ai.error, external.error, agents.error].filter((e): e is string => Boolean(e));
    const inWarmup = Date.now() - PROCESS_START_TIME < HEALTH_WARMUP_WINDOW_MS;
    const { statusCode, statusText } = resolveHealthStatus({
        dbOk: db.status === 'connected',
        aiOk: ai.status !== 'unhealthy',
        errors,
        inWarmup,
    });

    res.status(statusCode).json({
        status: statusText,
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
        warmup: inWarmup,
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
  { path: '/efficacy', router: efficacyRoutes },
  { path: '/advisories', router: advisoriesRoutes },
  { path: '/outbreaks', router: outbreaksRoutes },
  { path: '/field-intel', router: fieldIntelligenceRoutes },
  { path: '/alerts', router: alertRoutes },
  { path: '/external', router: externalRoutes },
  { path: '/language', router: languageRoutes },
  { path: '/ai', router: aiRoutes },
  { path: '/upload', router: uploadRoutes },
  { path: '/data-rights', router: dataRightsRoutes },
  { path: '/organizations', router: organizationsRoutes },
  { path: '/ai/reviews', router: recommendationReviewRoutes },
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
  { path: '/canadian', router: canadianServicesRoutes },
  { path: '/channels', router: channelsRoutes },
  { path: '/campaigns', router: campaignsRoutes },
  { path: '/verification', router: verificationFraudRoutes },
  { path: '/activities', router: activityTriageRoutes },
];

// Mount with i18n support (v1)
app.use(i18nUrlMiddleware);
app.use(i18nRouteHandler);
routeMounts.forEach(m => app.use(`/api/v1${m.path}`, m.router));

// Also mount public shares (no v1 prefix needed)
app.use('/api/public/shares', publicShareRouter);

// Create MCP router dynamically to support modern module standards and tree-shaking
let mcpRouter: Router | null = null;
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
