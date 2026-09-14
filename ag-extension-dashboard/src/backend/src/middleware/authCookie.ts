import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/**
 * httpOnly cookie auth + CSRF double-submit protection.
 *
 * The JWT moves out of localStorage (readable by any XSS payload) into an
 * httpOnly cookie. Because cookies are attached automatically by the browser,
 * state-changing endpoints are protected with a CSRF double-submit token that
 * is cryptographically bound to the session: csrf = HMAC(secret, sha256(token)).
 * The server can recompute the expected value from the presented token, so no
 * server-side CSRF storage is needed and a token pair stolen from one session
 * cannot be replayed against another.
 */

export const AUTH_COOKIE_NAME = 'ag_token';
export const CSRF_COOKIE_NAME = 'ag_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Parse the JWT lifetime (e.g. "7d") into seconds for cookie maxAge. Defaults to 7 days. */
function jwtMaxAgeSeconds(): number {
    const raw = String(config.jwt.expiresIn || '7d');
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 3600;
    const value = Number.parseInt(match[1], 10);
    const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (unitSeconds[match[2]] || 86400);
}

export function setAuthCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        // Lax blocks cross-site POST navigation; the CSRF layer below handles
        // the rest. Strict would break the TeleCall invite-link flow.
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
        maxAge: jwtMaxAgeSeconds() * 1000,
    });
    res.cookie(CSRF_COOKIE_NAME, csrfTokenFor(token), {
        // Readable by the SPA so it can echo the value in the CSRF header.
        httpOnly: false,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
        maxAge: jwtMaxAgeSeconds() * 1000,
    });
}

export function clearAuthCookie(res: Response): void {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

/** CSRF token bound to a specific session token — recomputable server-side. */
export function csrfTokenFor(token: string): string {
    return crypto
        .createHmac('sha256', config.jwt.secret)
        .update(crypto.createHash('sha256').update(token).digest('hex'))
        .digest('hex');
}

function timingSafeEqualStr(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extract the bearer token: Authorization header first (mobile, browser
 * extension, API clients), then the httpOnly cookie (SPA).
 */
export function getBearerToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();
        if (token) return token;
    }
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE_NAME];
    return typeof cookieToken === 'string' && cookieToken.length > 0 ? cookieToken : null;
}

/**
 * CSRF middleware (double-submit, session-bound).
 *
 * - Safe methods pass.
 * - Requests authenticated via the Authorization header pass (not cookie-based,
 *   so not CSRF-able).
 * - Pre-auth endpoints (/auth/login|register|demo|refresh|logout, password
 *   reset, email verification, MFA verification) are exempt — there is no
 *   victim session to abuse. MFA setup/enable/disable and session management
 *   remain protected.
 * - Signature-verified inbound webhooks are exempt (they authenticate via HMAC
 *   on the raw body, not cookies).
 * - Everything else: x-csrf-token header must match the ag_csrf cookie AND the
 *   token's session binding.
 */
const CSRF_EXEMPT_PATHS = new Set([
    '/api/auth/login', '/api/v1/auth/login',
    '/api/auth/register', '/api/v1/auth/register',
    '/api/auth/demo', '/api/v1/auth/demo',
    '/api/auth/refresh', '/api/v1/auth/refresh',
    '/api/auth/logout', '/api/v1/auth/logout',
    '/api/auth/forgot-password', '/api/v1/auth/forgot-password',
    '/api/auth/reset-password', '/api/v1/auth/reset-password',
    '/api/auth/verify-email', '/api/v1/auth/verify-email',
    '/api/auth/resend-verification', '/api/v1/auth/resend-verification',
    '/api/auth/mfa/verify', '/api/v1/auth/mfa/verify',
    '/api/errors',
    '/api/billing/webhook', '/api/v1/billing/webhook',
    '/api/whatsapp/inbound', '/api/v1/whatsapp/inbound',
    '/api/sms/inbound', '/api/v1/sms/inbound',
    '/api/channels/telegram/webhook', '/api/v1/channels/telegram/webhook',
    // Health probes are read-only but GET only — covered by the method check.
]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    // Bearer-token callers are immune to CSRF (the browser never attaches
    // their Authorization header automatically).
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return next();
    }

    // Cookie callers only from here on. No auth cookie → nothing to forge.
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
        return next();
    }

    const path = req.path.replace(/\/{2,}/g, '/');
    if (CSRF_EXEMPT_PATHS.has(path)) {
        return next();
    }

    const cookieCsrf = cookies?.[CSRF_COOKIE_NAME];
    const headerCsrf = req.headers[CSRF_HEADER_NAME];
    if (
        typeof cookieCsrf === 'string' &&
        typeof headerCsrf === 'string' &&
        timingSafeEqualStr(cookieCsrf, headerCsrf) &&
        timingSafeEqualStr(cookieCsrf, csrfTokenFor(token))
    ) {
        return next();
    }

    logger.warn(`CSRF validation failed for ${req.method} ${req.path} from ${req.ip}`);
    res.status(403).json({ success: false, error: 'CSRF token missing or invalid' });
}
