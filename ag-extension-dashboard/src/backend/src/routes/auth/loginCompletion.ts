/**
 * The last step of signing in, shared by password and phone-code sign-in: a two-factor
 * challenge when the account has it, otherwise a session, cookie and the user payload.
 */
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { recordLoginAttempt, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { createSession, withUserSessionLock } from '@/services/sessionService';
import { setAuthCookie } from '@/middleware/authCookie';
import { credentialVersion } from '@/utils/credentialVersion';
import { reportedSystemAdmin } from '@/services/systemAdminService';
import { signSessionToken } from '@/utils/sessionToken';

async function resolveLoginPlan(user: { id: string; role: string; is_demo?: boolean; email: string }) {
    let planName = 'Free';
    let isFree = true;

    if (user.role === 'admin') {
        planName = 'Admin';
        isFree = false;
    } else if (user.is_demo || user.email === 'demo@agridemo.com') {
        planName = 'Free';
        isFree = true;
    } else {
        try {
            const subResult = await query(`
                SELECT sp.name as plan_name, sp.price
                FROM subscriptions s
                JOIN subscription_plans sp ON sp.id = s.plan_id
                WHERE s.user_id = $1
                  AND (s.status = 'active' OR s.status = 'trialing')
                  AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
            `, [user.id]);
            if (subResult.rows.length > 0) {
                const row = subResult.rows[0];
                const price = row.price != null ? Number(row.price) : 0;
                planName = row.plan_name || 'Free';
                isFree = price === 0 || planName.toLowerCase().includes('free');
            }
        } catch {
            // fallback to Free
        }
    }
    return { planName, isFree };
}

export interface LoginUser {
    id: string;
    email: string;
    password_hash: string | null;
    region: string | null;
    country?: string | null;
    time_zone?: string | null;
    role: string;
    first_name: string | null;
    last_name: string | null;
    mfa_enabled: boolean;
    is_demo?: boolean;
    is_system_admin?: boolean | null;
}

export interface LoginUserRow extends LoginUser {
    lockout_until?: Date | string | null;
    email_verified?: boolean | null;
    /** false once an administrator switched the account off (someone who left). */
    is_active?: boolean | null;
}

async function completePasswordLogin(req: Request, res: Response, user: LoginUser, clientIp: string | null): Promise<void> {
    const token = signSessionToken({ userId: user.id, email: user.email, role: user.role });

    const sessionCreated = await withUserSessionLock(user.id, async client => {
        const current = await client.query<{ password_hash: string | null }>(
            'SELECT password_hash FROM users WHERE id = $1 FOR UPDATE', [user.id]
        );
        if (current.rows[0]?.password_hash !== user.password_hash) return false;
        await createSession({
            userId: user.id,
            token,
            ipAddress: clientIp,
            userAgent: req.get('user-agent'),
            location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
        }, client);
        return true;
    });
    if (!sessionCreated) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
    }

    await recordLoginAttempt({
        userId: user.id,
        email: user.email,
        status: 'success',
        ipAddress: clientIp,
        userAgent: req.get('user-agent'),
        location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
    });

    const { planName, isFree } = await resolveLoginPlan({
        id: user.id, role: user.role, is_demo: user.is_demo, email: user.email,
    });

    setAuthCookie(res, token);

    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                isDemo: user.is_demo === true || user.email?.toLowerCase() === 'demo@agridemo.com',
                isSystemAdmin: reportedSystemAdmin(user),
                region: user.region,
                country: user.country ?? null,
                timeZone: user.time_zone ?? null,
                mfaEnabled: !!user.mfa_enabled,
                planName,
                isFree,
            },
        },
    });
}


/** Two-factor challenge when enabled, otherwise a signed-in session. */
export async function finishSignIn(req: Request, res: Response, user: LoginUser, clientIp: string | null): Promise<void> {
    if (user.mfa_enabled) {
        const tempToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                mfaPending: true,
                credentialVersion: credentialVersion(user.password_hash),
            },
            config.jwt.secret as jwt.Secret,
            { algorithm: 'HS256', expiresIn: '5m' }
        );
        res.json({
            success: true,
            data: {
                mfaRequired: true,
                // Kept in the JSON body (never a cookie): 5m lifetime, and
                // mfa/verify is CSRF-exempt so the challenge works pre-auth.
                tempToken,
                message: 'Two-factor authentication required. Please enter your 6-digit TOTP code or a backup code.',
            },
        });
        return;
    }
    // httpOnly cookie for the SPA; the body token remains for
    // mobile/extension/API clients (they never receive cookies' protection
    // and still authenticate via the Authorization header).
    await completePasswordLogin(req, res, user, clientIp);
}
