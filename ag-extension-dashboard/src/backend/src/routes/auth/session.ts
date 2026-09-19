import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getLoginHistory, getLoginStats } from '@/services/loginHistoryService';
import { isSessionValid } from '@/services/sessionService';
import { setAuthCookie, clearAuthCookie, getBearerToken } from '@/middleware/authCookie';
import { isSubscriptionActive } from '@/services/paymentService';

const router = Router();

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * Shared bearer-token auth for the session routes. Verifies the JWT signature
 * (pinned to HS256) AND checks the session has not been revoked — identical
 * semantics to the `authorize` middleware. Hand-rolled `jwt.verify` calls
 * previously skipped the revocation check, letting logged-out tokens read
 * /me, /login-history and /login-stats.
 */
async function requireSession(req: Request): Promise<JWTPayload | null> {
    // Header first, then the httpOnly auth cookie — mirrors authorize().
    const token = getBearerToken(req);
    if (!token) return null;
    let decoded: JWTPayload;
    try {
        decoded = jwt.verify(token, config.jwt.secret as jwt.Secret, { algorithms: ['HS256'] }) as JWTPayload;
    } catch {
        return null;
    }
    if (!(await isSessionValid(token))) return null;
    return decoded;
}

// Refresh token.
// Accepts a token that expired up to REFRESH_GRACE_SECONDS ago so a client that
// was offline through expiry can recover its session without re-login, provided
// the underlying session was never revoked. Issues a fresh token + session row.
const REFRESH_GRACE_SECONDS = 7 * 24 * 3600;

router.post('/refresh', async (req: Request, res: Response) => {
    try {
        // Cookie callers (SPA) send no body token — the httpOnly cookie carries
        // the current JWT. Header/body callers (mobile/extension) keep working.
        const token = getBearerToken(req) || (typeof req.body?.token === 'string' ? req.body.token : null);

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required',
            });
        }

        const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret, { algorithms: ['HS256'], ignoreExpiration: true }) as JWTPayload & { exp?: number; mfaPending?: boolean };
        if (decoded.mfaPending) {
            return res.status(401).json({ success: false, error: 'MFA challenge tokens cannot be refreshed' });
        }
        if (decoded.exp && decoded.exp * 1000 + REFRESH_GRACE_SECONDS * 1000 < Date.now()) {
            return res.status(401).json({ success: false, error: 'Token expired beyond refresh window; please log in again' });
        }

        const { isSessionValid, createSession, revokeToken } = await import('@/services/sessionService');
        if (!(await isSessionValid(token))) {
            return res.status(401).json({ success: false, error: 'Session has been revoked' });
        }

        const newToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, role: decoded.role },
            config.jwt.secret as jwt.Secret,
            { algorithm: 'HS256', expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        // Rotate: the old token is retired locally and a new session row is recorded.
        revokeToken(token);
        try {
            await createSession({
                userId: decoded.userId,
                token: newToken,
                ipAddress: req.ip ?? null,
                userAgent: req.get('user-agent') ?? null,
            });
        } catch (sessionErr) {
            logger.warn('Refresh: failed to record rotated session (continuing):', sessionErr);
        }

        setAuthCookie(res, newToken);

        res.json({
            success: true,
            data: { token: newToken },
        });
    } catch (error) {
        logger.warn('Token refresh rejected:', error instanceof Error ? error.message : error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Logout — revokes the presented session so the token is dead immediately,
// not at JWT expiry. Idempotent: already-revoked/unknown tokens still 200 so
// clients can always clear local state.
router.post('/logout', async (req: Request, res: Response) => {
    // Works for both auth styles: Bearer header or httpOnly cookie.
    const token = getBearerToken(req);
    if (token) {
        const { revokeSessionByToken } = await import('@/services/sessionService');
        const revoked = await revokeSessionByToken(token);
        if (!revoked) {
            logger.info('Logout for token without a session row (legacy/demo) — revocation list entry written');
        }
    }
    // Always clear the cookies, even when the token was missing/unknown —
    // logout must never leave an auth cookie behind.
    clearAuthCookie(res);
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
    const token = getBearerToken(req);

    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const decoded = await requireSession(req);
        if (!decoded) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const result = await query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.region, u.is_demo,
                   sp.name as plan_name,
                   sp.price as plan_price,
                   s.status as subscription_status,
                   s.current_period_end as subscription_period_end
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
            WHERE u.id = $1
        `, [decoded.userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        let planName = 'Free';
        let isFree = true;
        if (user.role === 'admin') {
            planName = 'Admin';
            isFree = false;
        } else if (user.is_demo || user.email === 'demo@agridemo.com') {
            planName = 'Free';
            isFree = true;
        } else if (user.plan_name && isSubscriptionActive({ status: user.subscription_status, currentPeriodEnd: user.subscription_period_end })) {
            const price = user.plan_price != null ? Number(user.plan_price) : 0;
            planName = user.plan_name;
            isFree = price === 0 || planName.toLowerCase().includes('free');
        }

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
                isFree,
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
    if (!getBearerToken(req)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const decoded = await requireSession(req);
        if (!decoded) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

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
    if (!getBearerToken(req)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const decoded = await requireSession(req);
        if (!decoded) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

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
