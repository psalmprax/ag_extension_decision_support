import { Response, NextFunction } from 'express';
import { usageService, UsageType } from '../services/usageService';
import { AuthRequest } from './authorize';
import { logger } from '../utils/logger';

/**
 * Middleware to check if a user has exceeded their subscription usage limits,
 * and to meter the call once the route responds successfully.
 *
 * Metering happens here (on `finish`, 2xx only) so that every gated route is
 * counted without each handler having to remember to call incrementUsage.
 * Handlers that already increment explicitly can pass `{ meter: false }`.
 *
 * @param type The type of usage to check (sms, ai_chat, report, ai_vision, speech, whatsapp, knowledge)
 */
export const checkUsageLimit = (type: UsageType, options: { meter?: boolean } = {}) => {
    const meter = options.meter !== false;
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

        const userId = req.user.userId;

        try {
            const { allowed, current, limit, message } = await usageService.checkLimit(userId, type);

            if (!allowed) {
                logger.warn(`User ${userId} blocked/exceeded ${type} limit: ${current}/${limit}`);
                res.status(403).json({
                    success: false,
                    error: message || `Usage limit exceeded for ${type}`,
                    limitReached: true,
                    upgradeRequired: limit === 0,
                    details: {
                        type,
                        current,
                        limit,
                        message: message || `You have reached your ${type} limit of ${limit} for the current period.`
                    },
                });
                return;
            }
        } catch (error) {
            // Fail closed: if we cannot verify the quota we must not grant a paid
            // capability. (Tests run without a DB; checkLimit already special-cases that.)
            logger.error(`Error checking ${type} limit for user ${userId}:`, error);
            res.status(503).json({
                success: false,
                error: 'Unable to verify subscription usage right now. Please retry shortly.',
                errorCode: 'USAGE_CHECK_UNAVAILABLE',
            });
            return;
        }

        if (meter && type !== 'knowledge' && typeof res.on === 'function') {
            res.on('finish', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    usageService.incrementUsage(userId, type).catch(err =>
                        logger.warn(`Failed to meter ${type} usage for ${userId}:`, err)
                    );
                }
            });
        }

        next();
    };
};
