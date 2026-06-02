import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest } from './authorize';
import { Response } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config';

/**
 * Professional Rate Limiter that prioritizes authenticated users.
 * Uses userId as key if available, otherwise falls back to IP.
 */
export const perUserRateLimit = rateLimit({
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
    skip: (req: AuthRequest) => {
        // Allow override via env var for staging/dev-facing deployments
        if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
        // Skip in test only (not dev — staging should be rate-limited)
        return config.nodeEnv === 'test';
    },
    handler: (req: AuthRequest, res: Response) => {
        logger.warn(`Rate limit exceeded for user: ${req.user?.userId || req.ip}`);
        res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please wait a few minutes before trying again.'
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

