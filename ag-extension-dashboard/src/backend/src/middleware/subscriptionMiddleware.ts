import { Response, NextFunction } from 'express';
import { usageService } from '../services/usageService';
import { AuthRequest } from './authorize';
import { logger } from '../utils/logger';

function isDemoPrincipal(user: NonNullable<AuthRequest['user']>): boolean {
    return Boolean(user.isDemo || user.email === 'demo@agridemo.com');
}

/**
 * Middleware to gate Pro/Enterprise feature routers and endpoints behind an
 * active paid subscription (admins and demo accounts are exempted).
 */
export const requirePaidPlan = (featureLabel: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        if (req.user.role === 'admin' || isDemoPrincipal(req.user)) {
            return next();
        }

        try {
            const isFree = await usageService.isFreeUser(req.user.userId, req.user.role);
            if (isFree) {
                res.status(403).json({
                    success: false,
                    limitReached: true,
                    upgradeRequired: true,
                    error: `${featureLabel} requires a Pro or Enterprise subscription. Please upgrade your plan to access this feature.`,
                });
                return;
            }
            return next();
        } catch (error) {
            logger.error(`Subscription verification failed for ${featureLabel}:`, error);
            res.status(503).json({
                success: false,
                error: 'Unable to verify subscription status',
            });
        }
    };
};
