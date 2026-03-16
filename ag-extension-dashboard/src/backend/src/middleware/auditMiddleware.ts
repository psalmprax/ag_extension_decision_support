import { Request, Response, NextFunction } from 'express';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

export const auditMiddleware = (actionType: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const originalSend = res.send;
        
        // Proxy the send method to capture completion
        res.send = function(body?: unknown) {
            const statusCode = res.statusCode;
            
            // Only log successful or important actions
            if (statusCode >= 200 && statusCode < 300) {
                const userId = (req as AuthenticatedRequest).user?.id;
                const metadata = {
                    method: req.method,
                    path: req.path,
                    params: req.params,
                    query: req.query,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    status: statusCode
                };

                // Async logging to not block response
                query(`
                    INSERT INTO analytics_events (event_type, user_id, metadata, created_at)
                    VALUES ($1, $2, $3, NOW())
                `, [actionType, userId, JSON.stringify(metadata)])
                .catch(err => logger.error('Audit logging failed:', err));
            }

            return originalSend.call(res, body);
        };

        next();
    };
};

/**
 * Specifically log profile changes or sensitive farmer data access
 */
export const logSensitiveAction = async (userId: string, action: string, metadata: Record<string, unknown>) => {
    try {
        await query(`
            INSERT INTO analytics_events (event_type, user_id, metadata, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [action, userId, JSON.stringify(metadata)]);
    } catch (err) {
        logger.error(`Manual audit log failed for ${action}:`, err);
    }
};
