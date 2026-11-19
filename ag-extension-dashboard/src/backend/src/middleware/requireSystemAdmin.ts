import { NextFunction, Request, Response } from 'express';
import { isSystemAdminUser } from '@/services/systemAdminService';
import { logger } from '@/utils/logger';

/**
 * System-administrator gate.
 *
 * The flag is read from the database per request instead of trusted from the
 * JWT, because a revoked system-admin flag must not stay powerful until the
 * holder's current token expires. Mount it after `authorize`, which has already
 * verified the token and its session.
 */
export const requireSystemAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ success: false, error: 'No token provided' });
        return;
    }

    try {
        if (!(await isSystemAdminUser(userId))) {
            logger.warn(`User ${userId} with role ${req.user?.role} tried a system-administrator action`);
            res.status(403).json({
                success: false,
                error: 'System administrator privileges required',
                errorCode: 'SYSTEM_ADMIN_REQUIRED',
            });
            return;
        }
        req.user!.isSystemAdmin = true;
        next();
    } catch (error) {
        logger.error('System administrator check failed:', error);
        res.status(500).json({ success: false, error: 'Authorization error' });
    }
};
