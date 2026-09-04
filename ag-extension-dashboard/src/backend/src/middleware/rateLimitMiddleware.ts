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

