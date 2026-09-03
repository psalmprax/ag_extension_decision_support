import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getLoginHistory, getLoginStats } from '@/services/loginHistoryService';

const router = Router();

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

// Refresh token
router.post('/refresh', (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required',
            });
        }

        // Verify and refresh token
        const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret) as JWTPayload;

        const newToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, role: decoded.role },
            config.jwt.secret as jwt.Secret,
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        res.json({
            success: true,
            data: { token: newToken },
        });
    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Logout — clear auth on client side (server can't invalidate stateless JWT without a blocklist)
router.post('/logout', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
    // In production, verify JWT from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const result = await query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.region,
                   COALESCE(sp.name, 'Free') as plan_name,
                   COALESCE(s.status, 'active') as subscription_status
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
            WHERE u.id = $1
        `, [decoded.userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        const planName = user.plan_name || 'Free';

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                region: user.region,
                planName,
                isFree: planName.toLowerCase() === 'free',
            },
        });
    } catch {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

/**
 * GET /api/v1/auth/login-history
 * Query login history entries for security audit.
 */
router.get('/login-history', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const { email, status, limit, offset, userId } = req.query;
        const isManager = decoded.role === 'admin' || decoded.role === 'regional_manager';

        // Non-managers can only query their own history
        const targetUserId = isManager ? ((userId as string) || (email ? undefined : decoded.userId)) : decoded.userId;

        const history = await getLoginHistory({
            userId: targetUserId,
            email: isManager ? (email as string) : undefined,
            status: status as string,
            limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10))) : 20,
            offset: offset ? Math.max(0, parseInt(offset as string, 10)) : 0,
        });

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        logger.error('Failed to get login history:', error);
        res.status(401).json({ success: false, error: 'Invalid token or request failed' });
    }
});

/**
 * GET /api/v1/auth/login-stats
 * Query high-level login metrics for the current user or tenant.
 */
router.get('/login-stats', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const { userId } = req.query;
        const isManager = decoded.role === 'admin' || decoded.role === 'regional_manager';
        const targetUserId = isManager && userId ? (userId as string) : decoded.userId;

        const stats = await getLoginStats({ userId: targetUserId });

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error('Failed to get login stats:', error);
        res.status(401).json({ success: false, error: 'Invalid token or request failed' });
    }
});

export default router;
