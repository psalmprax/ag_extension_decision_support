import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getLoginHistory, getLoginStats } from '@/services/loginHistoryService';
import { createSession, isSessionValid, revokeToken, withUserSessionLock } from '@/services/sessionService';
import { setAuthCookie, clearAuthCookie, getBearerToken } from '@/middleware/authCookie';
import { isSubscriptionActive } from '@/services/subscriptionUtils';
import {
    buildUserProfileColumns,
    buildSubscriptionJoin,
    SUBSCRIPTION_PLAN_COLUMNS,
} from '@/services/userQueryBuilder';
import { z } from 'zod';
import type { NotificationPreferences } from '@/services/notificationPreferences';
import { validate } from '@/middleware/validationMiddleware';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { authorize } from '@/middleware/authorize';
import rateLimit from 'express-rate-limit';
import { perUserRateLimit, SharedStateStore } from '@/middleware/rateLimitMiddleware';
import { reportedSystemAdmin } from '@/services/systemAdminService';
import { signSessionToken } from '@/utils/sessionToken';
import { activeServicesFor } from '@/services/serviceAccessService';
import { findCountry, isValidTimeZone } from '@/shared-api/countries';
import { toE164 } from '@/services/country/phone';
import { countryOfUser } from '@/services/country/countryContext';

const router = Router();
const profileUpdateRateLimit = rateLimit({
    store: new SharedStateStore('rl:auth:profile:'),
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

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
const notificationPreferencesSchema = z.object({
    emailAlerts: z.boolean().optional(),
    smsAlerts: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
}).strict();

/** Personalisation shown on the profile and in the menu; saved on the account. */
const profileSettingsSchema = z.object({
    handle: z.string().trim().regex(/^[a-z0-9_.]{3,30}$/i, 'Handles are 3–30 letters, digits, dots or underscores').optional(),
    avatarId: z.string().regex(/^[a-z_]{2,40}$/).optional(),
    areaUnit: z.enum(['hectares', 'acres']).optional(),
    tempUnit: z.enum(['celsius', 'fahrenheit']).optional(),
    highContrast: z.boolean().optional(),
}).strict();

const updateProfileSchema = z.object({
    body: z.object({
        firstName: z.string().trim().min(1).max(100).optional(),
        lastName: z.string().trim().min(1).max(100).optional(),
        phone: z.string().trim().max(40).optional(),
        country: z.string().trim().refine(value => findCountry(value) !== null, 'Unknown country').optional(),
        timeZone: z.string().trim().refine(isValidTimeZone, 'Unknown time zone').optional(),
        notificationPreferences: notificationPreferencesSchema.optional(),
        profileSettings: profileSettingsSchema.optional(),
    }).strict().refine(body => Object.keys(body).length > 0, 'At least one profile field is required'),
});

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

        if (!(await isSessionValid(token))) {
            return res.status(401).json({ success: false, error: 'Session has been revoked' });
        }

        const newToken = signSessionToken({ userId: decoded.userId, email: decoded.email, role: decoded.role });

        // Rotate under the account lock so a concurrent password change cannot
        // revoke the old token and then have this request create a surviving session.
        const sessionCreated = await withUserSessionLock(decoded.userId, async client => {
            if (!(await isSessionValid(token))) return false;
            revokeToken(token);
            await createSession({
                userId: decoded.userId,
                token: newToken,
                ipAddress: req.ip ?? null,
                userAgent: req.get('user-agent') ?? null,
            }, client);
            return true;
        });
        if (!sessionCreated) {
            return res.status(401).json({ success: false, error: 'Session has been revoked' });
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
router.patch('/me', profileUpdateRateLimit, authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), perUserRateLimit, validate(updateProfileSchema), auditMiddleware('auth.profile_update'), async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const updates = req.body as {
        firstName?: string; lastName?: string; phone?: string; country?: string; timeZone?: string;
        notificationPreferences?: NotificationPreferences; profileSettings?: Record<string, unknown>;
    };
    // Phone numbers are kept in E.164, read in the person's (possibly just changed) country.
    let phone: string | undefined;
    if (updates.phone) {
        const international = /^(\+|00)/.test(updates.phone.trim());
        const country = updates.country ?? (international ? null : await countryOfUser(userId));
        phone = toE164(updates.phone, country) ?? undefined;
        if (!phone) return res.status(400).json({ success: false, error: `That phone number is not valid for ${country ?? 'your country'}.` });
    }
    const fields: Array<[string, unknown]> = [
        ['first_name', updates.firstName],
        ['last_name', updates.lastName],
        ['phone', phone],
        ['country', updates.country ? findCountry(updates.country)?.name : undefined],
        ['time_zone', updates.timeZone],
    ].filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    const assignments = fields.map(([column], index) => `${column} = $${index + 1}`);
    const values: unknown[] = fields.map(([, value]) => value);
    if (updates.notificationPreferences) {
        // Merge, so toggling one channel never resets the others.
        values.push(JSON.stringify(updates.notificationPreferences));
        assignments.push(`notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || $${values.length}::jsonb`);
    }
    if (updates.profileSettings) {
        values.push(JSON.stringify(updates.profileSettings));
        assignments.push(`profile_settings = COALESCE(profile_settings, '{}'::jsonb) || $${values.length}::jsonb`);
    }
    try {
        const result = await query(
            `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
             WHERE id = $${values.length + 1}
             RETURNING ${buildUserProfileColumns({ includeNotificationPreferences: true, includeSystemAdmin: true })}`,
            [...values, userId]
        );
        const user = result.rows[0];
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        return res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                isDemo: user.is_demo === true || user.email?.toLowerCase() === 'demo@agridemo.com',
                isSystemAdmin: reportedSystemAdmin(user),
                region: user.region,
                country: user.country,
                timeZone: user.time_zone ?? null,
                phone: user.phone,
                notificationPreferences: user.notification_preferences ?? {},
                profileSettings: user.profile_settings ?? {},
            },
        });
    } catch (error) {
        logger.error('Profile update failed:', error);
        return res.status(500).json({ success: false, error: 'Profile update failed' });
    }
});

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
            SELECT ${buildUserProfileColumns({
                source: 'u',
                includeNotificationPreferences: true,
                includeDemoFlag: true,
                includeSystemAdmin: true,
            })},
                   ${SUBSCRIPTION_PLAN_COLUMNS}
            FROM users u
            ${buildSubscriptionJoin('u')}
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
                isSystemAdmin: reportedSystemAdmin(user),
                region: user.region,
                country: user.country,
                timeZone: user.time_zone ?? null,
                phone: user.phone,
                notificationPreferences: user.notification_preferences ?? {},
                profileSettings: user.profile_settings ?? {},
                planName,
                isFree,
                // Paid services the system administrator opened to this account beyond its plan.
                serviceAccess: isFree ? await activeServicesFor(user.id) : [],
            },
        });
    } catch (error) {
        logger.error('Failed to get user profile (/me):', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
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
        res.status(500).json({ success: false, error: 'Failed to retrieve login history' });
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
        res.status(500).json({ success: false, error: 'Failed to retrieve login stats' });
    }
});

export default router;
