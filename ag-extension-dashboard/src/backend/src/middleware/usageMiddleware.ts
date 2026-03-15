import { Response, NextFunction } from 'express';
import { usageService, UsageType } from '../services/usageService';
import { AuthRequest } from './authorize';
import { logger } from '../utils/logger';

/**
 * Middleware to check if a user has exceeded their subscription usage limits
 * @param type The type of usage to check (sms, ai_chat, report)
 */
export const checkUsageLimit = (type: UsageType) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        // Admins have no limits
        if (req.user.role === 'admin') {
            return next();
        }

        try {
            const { allowed, current, limit } = await usageService.checkLimit(req.user.userId, type);

            if (!allowed) {
                logger.warn(`User ${req.user.userId} exceeded ${type} limit: ${current}/${limit}`);
                res.status(403).json({
                    success: false,
                    error: `Usage limit exceeded for ${type}`,
                    details: {
                        type,
                        current,
                        limit,
                        message: `You have reached your ${type} limit of ${limit} for the current billing period.`
                    },
                });
                return;
            }

            next();
        } catch (error) {
            logger.error(`Error checking ${type} limit for user ${req.user.userId}:`, error);
            // In case of error, we allow the request but log it
            // This prevents system errors from blocking valid users
            next();
        }
    };
};
