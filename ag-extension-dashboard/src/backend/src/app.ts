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
import { csrfProtection, AUTH_COOKIE_NAME } from './middleware/authCookie';
import { setupSwagger } from './utils/swagger';
import { getPool } from './services/databaseService';
import { getCache } from './services/cacheService';
import { degradationStatus } from './services/sharedState';
import { setRequestUserId } from './services/requestContext';

import { correlationIdMiddleware } from './middleware/correlationIdMiddleware';
import { perUserRateLimit, aiRateLimiter } from './middleware/rateLimitMiddleware';

/**
 * Wrap a router so every request first passes through the dedicated AI/LLM
 * rate limiter (separate, much smaller bucket than general API traffic).
 * Applied to routers whose endpoints invoke AI providers: /ai, /ai/diseases,
 * /ai/memories and the chatbot generation routes (inside the router itself).
 */
function aiRateLimiterMount<T extends Router>(router: T): T {
    const wrapped = Router();
    wrapped.use(aiRateLimiter);
    wrapped.use(router);
    return wrapped as unknown as T;
}
import { optionalAuth } from './middleware/authorize';
import { globalAuditMiddleware } from './middleware/auditMiddleware';
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
import soilRoutes from './routes/soil';
import pillarsRoutes from './routes/pillars';
import callRoutes from './routes/call';
import worldmonitorRoutes from './routes/worldmonitor';
import offlineRoutes from './routes/offline';
import auditLogsRoutes from './routes/auditLogs';
import accountRoutes from './routes/account';
import workflowsRoutes from './routes/workflows';

const app: Application = express();
// Trust exactly the number of reverse-proxy hops in front of the app (default 1 = Traefik).
// `true` would take the left-most X-Forwarded-For value, which the client controls, and
// let an attacker spoof req.ip to bypass per-IP rate limits and lockouts.
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
app.set('trust proxy', Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);

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
// Body parsing — deliberately SMALL by default. A 16MB pre-auth JSON parser on
// every route lets any anonymous request pin ~16MB × concurrency of process
// memory per request (DoS amplification) and widens the request-smuggling
// surface. Media-heavy endpoints opt back up to 16mb — but ONLY for
// authenticated requests (see below); anonymous clients are capped at 1mb
// everywhere except signature-verified webhook endpoints, which get a bounded
// 4mb allowance because providers legitimately push media payloads.
//
// Ordering:
//   1. optionalAuth FIRST — it only reads headers, so it can run before any
//      body parser, and the 16mb gate needs req.user.
//   2. Then the conditional 16mb parser (body parsers are stream consumers — a
//      parser further down the chain would never see a body the 1mb parser
//      already rejected). body-parser sets req._body after parsing, so the
//      global parsers below no-op on media routes instead of clobbering or 413.
//   3. Then the global 1mb parsers.
//
// Stripe webhooks are handled even earlier (raw body for signature
// verification) — see the STRIPE_WEBHOOK_PATHS block above.
const LARGE_BODY_ROUTES = [
    '/api/ai', '/api/chatbot', '/api/knowledge', '/api/pillars', '/api/upload',
    '/api/whatsapp', '/api/v1/ai', '/api/v1/chatbot', '/api/v1/knowledge',
    '/api/v1/pillars', '/api/v1/upload', '/api/v1/whatsapp',
];
const largeBodyParser = express.json({
    limit: process.env.LARGE_BODY_LIMIT || '50mb',
    verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
    },
});
// Signature-verified inbound webhook endpoints keep a bounded anonymous
// allowance — Meta/Twilio servers are anonymous to us by design.
const WEBHOOK_ROUTES = ['/api/whatsapp', '/api/v1/whatsapp', '/api/channels', '/api/v1/channels'];
app.use(cookieParser());
app.use(optionalAuth); // Parse optional user credentials before body parsing and rate limiting
app.use((req, res, next) => {
    if (req.method !== 'GET' && LARGE_BODY_ROUTES.some(p => req.path === p || req.path.startsWith(p + '/'))) {
        const isWebhook = WEBHOOK_ROUTES.some(p => req.path === p || req.path.startsWith(p + '/'));
        if (req.user || isWebhook) {
            return largeBodyParser(req, res, next);
        }
        // Anonymous client on a media route: cap at the small-parser limit and
        // let the global 1mb parser below handle (or reject) the body.
        return next();
    }
    next();
});

// Stripe webhook gets its RAW body here at the app level, BEFORE any JSON
// parser can consume the stream — otherwise req.body is a parsed object and
// signature verification fails. Stripe-signed requests are also exempt from
// the anonymous 1MB JSON cap (webhook payloads can exceed it legitimately).
const STRIPE_WEBHOOK_PATHS = ['/api/billing/webhook', '/api/v1/billing/webhook'];
app.use((req, res, next) => {
    if (req.method === 'POST' && STRIPE_WEBHOOK_PATHS.includes(req.path)) {
        return express.raw({ type: 'application/json' })(req, res, next);
    }
    next();
});

app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
    },
}));
app.use(express.urlencoded({
    extended: true,
    limit: '1mb',
    verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
    },
}));
app.use(securityGate); // Security gate — after auth/body parsing, before rate limiting
app.use(csrfProtection); // Cookie-auth CSRF double-submit check (Bearer callers pass through)
app.use((req, _res, next) => {
    setRequestUserId(req.user?.userId);
    next();
});
app.use(globalAuditMiddleware); // privileged / sensitive mutations → audit_logs
app.use(idempotencyMiddleware);

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    // SameSite=Lax already blocks cross-site POSTs in modern browsers; this
    // barrier is defense-in-depth for legacy/edge browsers and non-browser
    // abuse of the cookie.
    app.use((req, res, next) => {
        const secFetchSite = req.headers['sec-fetch-site'];
        if (
            typeof secFetchSite === 'string' &&
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
            !['same-origin', 'same-site', 'none'].includes(secFetchSite) &&
            req.cookies?.[AUTH_COOKIE_NAME]
        ) {
            logger.warn(`Blocked cross-site ${req.method} ${req.path} (Sec-Fetch-Site: ${secFetchSite})`);
            return res.status(403).json({ success: false, error: 'Cross-site request forbidden' });
        }
        next();
    });
}
app.use((req, res, next) => {
    const isAiHeavy = ['/api/knowledge', '/api/chatbot', '/api/v1/knowledge', '/api/v1/chatbot', '/api/ai', '/api/v1/ai', '/api/pillars', '/api/v1/pillars']
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

function checkDistributedState(): { status: string; error?: string } {
    const { redisBacked, degradedSince } = degradationStatus();
    if (redisBacked) return { status: 'shared' };
    return { status: 'degraded', error: `distributed-state: per-process fallback since ${degradedSince} — revocations/rate-limits not shared` };
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

// AI provider health checks hit external APIs — cache the result so an
// anonymous loop against /api/health cannot turn the backend into an amplifier
// that hammers the LLM providers (quota drain / provider-side rate limits).
const AI_HEALTH_CACHE_TTL_MS = 60_000;
let aiHealthCache: { at: number; primary: Awaited<ReturnType<typeof checkPrimaryProviderHealth>>; fallback: Awaited<ReturnType<typeof checkFallbackProvider>> } | null = null;
async function checkAIProvider(): Promise<{ status: string; error?: string }> {
    try {
        let primary: Awaited<ReturnType<typeof checkPrimaryProviderHealth>>;
        let fallback: Awaited<ReturnType<typeof checkFallbackProvider>>;
        if (aiHealthCache && Date.now() - aiHealthCache.at < AI_HEALTH_CACHE_TTL_MS) {
            primary = aiHealthCache.primary;
            fallback = aiHealthCache.fallback;
        } else {
            primary = await checkPrimaryProviderHealth();
            fallback = await checkFallbackProvider();
            aiHealthCache = { at: Date.now(), primary, fallback };
        }

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
        // Split by whether a credential is actually required. Reporting a default URL
        // as "configured" made this check claim full coverage with zero API keys.
        const keyed: Record<string, boolean> = {
            weather: !!config.externalApis.weather.apiKey,
            tavily: !!config.externalApis.tavily.apiKey,
        };
        // Keyless public endpoints have nothing to configure — they are reachable by
        // design, so they are reported separately and never counted as credentials.
        const keyless: Record<string, boolean> = {
            fao: !!config.externalApis.fao.url,
            nasa: true, // NASA POWER public endpoints require no key
        };

        const configuredKeyed = Object.keys(keyed).filter(k => keyed[k]);
        const reachableKeyless = Object.keys(keyless).filter(k => keyless[k]);

        const keylessNote = reachableKeyless.length
            ? `; keyless by design: ${reachableKeyless.join(', ')}`
            : '';

        if (configuredKeyed.length === 0) {
            return { status: `no keyed external APIs configured (0/${Object.keys(keyed).length})${keylessNote}` };
        }
        return {
            status: `${configuredKeyed.length}/${Object.keys(keyed).length} keyed external APIs configured (${configuredKeyed.join(', ')})${keylessNote}`,
        };
    } catch (error) {
        return { status: 'error', error: `external_apis: ${(error as Error).message}` };
    }
}

// Components registered for monitoring that are intentionally absent in this
// deployment can be listed here (comma-separated env) so they don't flag /health.
const PLANNED_AGENTS = new Set(
    (process.env.PLANNED_AGENTS || '').split(',').map(s => s.trim()).filter(Boolean)
);

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
export const DEFAULT_HEALTH_WARMUP_WINDOW_MS = 15_000;

export function getHealthWarmupWindowMs(): number {
    const raw = process.env.HEALTH_WARMUP_WINDOW_MS;
    if (!raw) return DEFAULT_HEALTH_WARMUP_WINDOW_MS;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_HEALTH_WARMUP_WINDOW_MS;
}

export const HEALTH_WARMUP_WINDOW_MS = getHealthWarmupWindowMs();
const PROCESS_START_TIME = Date.now();

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'healthy (warmup)' | 'starting (warmup)';

// Warm-up window: the DB dependency is tolerated (Prisma pool cold-start can
// outlast a single curl probe). The AI provider doesn't share this cold-start
// path, so it is still gated on during warmup.
export function resolveHealthStatus(opts: {
    dbOk: boolean;
    aiOk: boolean;
    errors: string[];
    inWarmup: boolean;
}): { statusCode: number; statusText: HealthStatus } {
    const { dbOk, aiOk, errors, inWarmup } = opts;

    if (inWarmup) {
        if (dbOk && aiOk && errors.length === 0) return { statusCode: 200, statusText: 'healthy (warmup)' };
        if (dbOk || aiOk) return { statusCode: 200, statusText: 'starting (warmup)' };
        return { statusCode: 503, statusText: 'unhealthy' };
    }

    // Strict post-warmup behavior:
    const isHealthyStrict = dbOk && aiOk && errors.length === 0;
    const isDegradedStrict = dbOk && (errors.length > 0 || !aiOk);
    return {
        statusCode: isHealthyStrict || isDegradedStrict ? 200 : 503,
        statusText: isHealthyStrict ? 'healthy' : isDegradedStrict ? 'degraded' : 'unhealthy',
    };
}

// Health check handler with full dependency checks
const healthHandler = async (req: Request, res: Response) => {
    const [db, cache, ai, external, agents] = await Promise.all([
        checkDatabase(),
        checkCache(),
        checkAIProvider(),
        Promise.resolve(checkExternalAPIs()),
        Promise.resolve(checkAgentServices()),
    ]);
    const distributed = checkDistributedState();

    const errors = [db.error, cache.error, ai.error, external.error, agents.error, distributed.error].filter((e): e is string => Boolean(e));
    const inWarmup = Date.now() - PROCESS_START_TIME < getHealthWarmupWindowMs();
    const { statusCode, statusText } = resolveHealthStatus({
        dbOk: db.status === 'connected',
        aiOk: ai.status !== 'unhealthy',
        errors,
        inWarmup,
    });

    // Detailed diagnostics (per-dependency status, failure reasons, node env,
    // uptime) are disclosed only to admins or same-origin probers carrying a
    // local check token. Anonymous callers get the verdict + code only — the
    // failure *why* (missing key vs 401 vs quota) is an inventory for attackers.
    const isAdmin = req.user?.role === 'admin';
    const isLocalProbe = process.env.NODE_ENV !== 'production' &&
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip || '');
    const includeDetails = isAdmin || isLocalProbe;

    res.status(statusCode).json({
        status: statusText,
        timestamp: new Date().toISOString(),
        ...(includeDetails ? {
            uptime: process.uptime(),
            environment: config.nodeEnv,
            version: '1.0.1',
            services: {
                database: db.status,
                cache: cache.status,
                distributed_state: distributed.status,
                ai_provider: ai.status,
                external_apis: external.status,
                agent_orchestrator: agents.status,
            },
            warmup: inWarmup,
            errors: errors.length > 0 ? errors : undefined,
        } : {}),
    });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
// Versioned alias so clients that only know the /api/v1 base (browser extension,
// mobile) can probe connectivity without hard-coding the unversioned path.
app.get('/api/v1/health', healthHandler);

app.get('/health/live', (_req: Request, res: Response) => res.json({ status: 'ok' }));
// Readiness gates on process-local dependencies only (DB + cache connectivity).
// Deliberately EXCLUDES the AI provider health check: that probes external
// services, belongs in /api/health (liveness/observability), and would keep
// pods out of rotation (or restart-loop them via liveness) on provider blips.
app.get('/health/ready', async (_req: Request, res: Response) => {
    const [db, cache] = await Promise.all([checkDatabase(), checkCache()]);
    const dbOk = db.status === 'connected';
    const cacheOk = cache.status === 'connected';
    const body = {
        status: dbOk && cacheOk ? 'ready' : 'not ready',
        services: {
            database: db.status,
            cache: cache.status,
        },
        timestamp: new Date().toISOString(),
    };
    if (dbOk && cacheOk) {
        res.status(200).json(body);
    } else {
        logger.warn('Readiness check failed:', body);
        res.status(503).json(body);
    }
});

// Apply global rate limiter to all API routes (excluding health checks)
app.use(limiter);

// API route mounts — defined once, mounted under /api/v1/ (with i18n) and /api/ (legacy)
type RouteMount = { path: string; router: express.Router };
const routeMounts: RouteMount[] = [
  { path: '/auth', router: authRoutes },
  { path: '/knowledge', router: knowledgeRoutes },
  { path: '/knowledge/sources', router: knowledgeSourcesRoutes },
  { path: '/knowledge/sync', router: knowledgeSyncRoutes },
  { path: '/chatbot', router: chatbotRoutes }, // aiRateLimiter applied inside the router (generation routes only)
  { path: '/ai', router: aiRateLimiterMount(aiRoutes) },
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
  { path: '/ai/memories', router: aiRateLimiterMount(memoryRoutes) },
  { path: '/ai/diseases', router: aiRateLimiterMount(diseaseRoutes) },
  { path: '/whatsapp', router: whatsappRoutes },
  { path: '/api-clients', router: apiClientRoutes },
  { path: '/commercial/knowledge', router: commercialKnowledgeRoutes },
  { path: '/canadian', router: canadianServicesRoutes },
  { path: '/channels', router: channelsRoutes },
  { path: '/campaigns', router: campaignsRoutes },
  { path: '/verification', router: verificationFraudRoutes },
  { path: '/activities', router: activityTriageRoutes },
  { path: '/soil', router: soilRoutes },
  { path: '/pillars', router: pillarsRoutes },
  { path: '/call', router: callRoutes },
  { path: '/worldmonitor', router: worldmonitorRoutes },
  { path: '/offline', router: offlineRoutes },
  { path: '/audit-logs', router: auditLogsRoutes },
  { path: '/account', router: accountRoutes },
  { path: '/workflows', router: workflowsRoutes },
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

// Legacy redirects (no i18n)
routeMounts.forEach(m => app.use(`/api${m.path}`, m.router));
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

// Client-side error reporting endpoint. Validated and size-capped: any
// anonymous client can POST here, so unbounded/log-shaped payloads would give
// an attacker free rein over the log stream (log injection / write spam).
const CLIENT_ERROR_FIELD_MAX = 2_000;
const CLIENT_ERROR_STACK_MAX = 8_000;
const clip = (v: unknown, max: number): string | undefined => {
    if (typeof v !== 'string') return undefined;
    // Strip control characters so newlines cannot forge log entries.
    // eslint-disable-next-line no-control-regex
    return v.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max) || undefined;
};
app.post('/api/errors', (req: Request, res: Response) => {
    const { error } = req.body || {};
    if (!error || typeof error !== 'object') {
        return res.status(400).json({ success: false, error: 'error object is required' });
    }
    logger.warn('Client error reported:', {
        message: clip(error.message, CLIENT_ERROR_FIELD_MAX) || 'unknown',
        stack: clip(error.stack, CLIENT_ERROR_STACK_MAX),
        name: clip(error.name, 100),
        componentName: clip(req.body?.componentName, 200),
        componentStack: clip(req.body?.componentStack, CLIENT_ERROR_STACK_MAX),
        url: clip(req.body?.url, 500),
        userAgent: clip(req.body?.userAgent, 300),
        ip: req.ip,
    });
    res.status(200).json({ success: true });
});

app.use(errorHandler);
app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Not Found' }));

export default app;
