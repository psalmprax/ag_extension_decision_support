import rateLimit, { ipKeyGenerator, type Store, type Options, type ClientRateLimitInfo } from 'express-rate-limit';
import { AuthRequest } from './authorize';
import { Response } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { incrWindow, resetWindow } from '@/services/sharedState';

/**
 * express-rate-limit Store backed by sharedState (Redis with process-local
 * fallback). Without this the default MemoryStore gives every replica its own
 * counter, multiplying the effective limit by the replica count.
 */
class SharedStateStore implements Store {
    private windowMs = 60_000;
    // `prefix` is part of the Store interface (public), so it must not be private here.
    prefix: string;
    localKeys = false;
    constructor(prefix: string) { this.prefix = prefix; }
    init(options: Options): void { this.windowMs = options.windowMs; }
    async increment(key: string): Promise<ClientRateLimitInfo> {
        const { count, resetAt } = await incrWindow(`${this.prefix}${key}`, this.windowMs);
        return { totalHits: count, resetTime: new Date(resetAt) };
    }
    async decrement(_key: string): Promise<void> { /* not needed for fixed windows */ }
    async resetKey(key: string): Promise<void> { await resetWindow(`${this.prefix}${key}`); }
}

/**
 * Dedicated limiter for AI/LLM endpoints (chat completions, vision, speech,
 * synthesis, agent execution). These routes are orders of magnitude more
 * expensive than CRUD traffic — each hit costs provider tokens and can take
 * seconds of provider latency — so they get their own, much smaller bucket
 * IN ADDITION to the general per-user limit above. Draining the AI bucket
 * no longer starves the general one, and vice versa.
 *
 * Configurable via env:
 *   AI_RATE_LIMIT_MAX       — authenticated requests per window (default 60)
 *   AI_RATE_LIMIT_WINDOW_MS — window length (default 5 minutes)
 */
const aiMax = Number.parseInt(process.env.AI_RATE_LIMIT_MAX || '60', 10);
const aiWindowMs = Number.parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '300000', 10);

export const aiRateLimiter = rateLimit({
    store: new SharedStateStore('rl:ai:'),
    windowMs: Number.isFinite(aiWindowMs) && aiWindowMs > 0 ? aiWindowMs : 300000,
    max: (req: AuthRequest) => {
        // Admins keep generous headroom but no longer an unlimited escape hatch.
        if (req.user?.role === 'admin') return 600;
        // Authenticated users: 60 AI calls / 5 min (12/min) — enough for
        // interactive agronomic chat, hostile to scripted token drains.
        if (req.user) return Number.isFinite(aiMax) && aiMax > 0 ? aiMax : 60;
        // Anonymous (public demo endpoints): tightest bucket.
        return 20;
    },
    keyGenerator: (req: AuthRequest) => {
        return req.user?.userId || ipKeyGenerator(req.ip || 'anonymous');
    },
    skip: (_req: AuthRequest) => {
        if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
        return config.nodeEnv === 'test';
    },
    handler: (_req: AuthRequest, res: Response) => {
        logger.warn(`AI rate limit exceeded for user: ${_req.user?.userId || _req.ip}`);
        res.status(429).json({
            success: false,
            error: 'Too many AI requests',
            message: 'You have exceeded the AI request limit. Please wait a few minutes before trying again.',
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Professional Rate Limiter that prioritizes authenticated users.
 * Uses userId as key if available, otherwise falls back to IP.
 */
export const perUserRateLimit = rateLimit({
    store: new SharedStateStore('rl:user:'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: AuthRequest) => {
        // Admins get virtual unlimited
        if (req.user?.role === 'admin') return 100000;
        // Authenticated users get 1000 requests per 15 mins
        if (req.user) return 1000;
        // Anonymous users get 150
        return 150;
    },
    keyGenerator: (req: AuthRequest) => {
        return req.user?.userId || ipKeyGenerator(req.ip || 'anonymous');
    },
    skip: (_req: AuthRequest) => {
        // Allow override via env var for staging/dev-facing deployments
        if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
        // Skip in test only (not dev — staging should be rate-limited)
        return config.nodeEnv === 'test';
    },
    handler: (_req: AuthRequest, res: Response) => {
        logger.warn(`Rate limit exceeded for user: ${_req.user?.userId || _req.ip}`);
        res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please wait a few minutes before trying again.'
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

