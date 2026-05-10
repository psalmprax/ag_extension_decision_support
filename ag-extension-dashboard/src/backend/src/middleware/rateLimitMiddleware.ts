import rateLimit from 'express-rate-limit';
import { AuthRequest } from './authorize';
import { Response } from 'express';
import { logger } from '@/utils/logger';

/**
 * Professional Rate Limiter that prioritizes authenticated users.
 * Uses userId as key if available, otherwise falls back to IP.
 */
export const perUserRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: AuthRequest) => {
        // Admins get unlimited
        if (req.user?.role === 'admin') return 10000;
        // Authenticated users get 500 requests per 15 mins
        if (req.user) return 500;
        // Anonymous users get 50
        return 50;
    },
    keyGenerator: (req: AuthRequest) => {
        return req.user?.userId || req.ip || 'anonymous';
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
