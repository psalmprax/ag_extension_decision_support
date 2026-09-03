import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { getUserSessions, revokeSession, revokeAllOtherSessions } from '@/services/sessionService';

const router = Router();

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * GET /api/v1/auth/sessions
 * List active sessions for the current user.
 */
router.get('/sessions', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const sessions = await getUserSessions(decoded.userId, token);
        res.json({
            success: true,
            data: sessions,
        });
    } catch (error) {
        logger.error('Failed to fetch sessions:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revoke a specific active session.
 */
router.delete('/sessions/:id', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const revoked = await revokeSession(req.params.id, decoded.userId);
        res.json({
            success: true,
            revoked,
            message: revoked ? 'Session revoked successfully' : 'Session not found or already revoked',
        });
    } catch (error) {
        logger.error('Failed to revoke session:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke session' });
    }
});

/**
 * POST /api/v1/auth/sessions/revoke-others
 * Revoke all other active sessions except the current one.
 */
router.post('/sessions/revoke-others', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const count = await revokeAllOtherSessions(decoded.userId, token);
        res.json({
            success: true,
            count,
            message: `Revoked ${count} other active session(s)`,
        });
    } catch (error) {
        logger.error('Failed to revoke other sessions:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke other sessions' });
    }
});

export default router;
