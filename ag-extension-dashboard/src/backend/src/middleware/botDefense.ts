import rateLimit from 'express-rate-limit';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { clientIpOf } from '@/utils/clientIp';
import { SharedStateStore } from './rateLimitMiddleware';

/**
 * Defences for the handful of routes a bot can reach WITHOUT an account: sign-up,
 * sign-in, the SMS-code request and the password-reset request. The global
 * per-user limiter gives every anonymous IP one shared 150/15-min bucket across
 * the whole API, so hammering one endpoint (mass sign-ups, credential stuffing,
 * draining the SMS budget) stays well inside it. These give each sensitive
 * endpoint its own, much tighter per-IP bucket, plus a honeypot and a minimum
 * fill-time on sign-up.
 *
 * This is the lightweight pre-filter. The real challenge (Cloudflare Turnstile)
 * is wired separately once its key is set; nothing here needs that key.
 */

/** Rate limiting is turned off for CI/local E2E and unit tests, same as the other limiters. */
function limitsDisabled(): boolean {
    return process.env.RATE_LIMIT_DISABLED === 'true' || config.nodeEnv === 'test';
}

/**
 * A per-IP fixed-window limiter backed by shared state (so every replica shares
 * one counter). Keyed by the proxy-trusted client IP, since the caller is
 * anonymous here and has no user id yet.
 */
function ipRateLimit(opts: { prefix: string; windowMs: number; max: number; message: string }) {
    return rateLimit({
        store: new SharedStateStore(opts.prefix),
        windowMs: opts.windowMs,
        max: opts.max,
        skip: () => limitsDisabled(),
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req: Request, res: Response) => {
            logger.warn(`Unauthenticated rate limit (${opts.prefix}) exceeded for ${clientIpOf(req) ?? 'unknown IP'}`);
            res.status(429).json({ success: false, error: opts.message, errorCode: 'RATE_LIMITED' });
        },
    });
}

const HOUR = 60 * 60 * 1000;
const FIFTEEN_MIN = 15 * 60 * 1000;

function envInt(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Account creation: a real person makes one or two, never dozens an hour from one address. */
export const registerIpRateLimit = ipRateLimit({
    prefix: 'rl:register:ip:',
    windowMs: HOUR,
    max: envInt('REGISTER_IP_MAX_PER_HOUR', 10),
    message: 'Too many sign-up attempts from this network. Please wait a while and try again.',
});

/** Sign-in: caps credential-stuffing from one address on top of the per-account lockout. */
export const loginIpRateLimit = ipRateLimit({
    prefix: 'rl:login:ip:',
    windowMs: FIFTEEN_MIN,
    max: envInt('LOGIN_IP_MAX_PER_15MIN', 30),
    message: 'Too many sign-in attempts from this network. Please wait a few minutes and try again.',
});

/** SMS-code requests cost real money to send; one address should need only a few. */
export const smsRequestIpRateLimit = ipRateLimit({
    prefix: 'rl:sms:ip:',
    windowMs: HOUR,
    max: envInt('SMS_REQUEST_IP_MAX_PER_HOUR', 15),
    message: 'Too many code requests from this network. Please wait a while and try again.',
});

/** Password-reset requests: throttle enumeration and inbox flooding per address. */
export const passwordResetIpRateLimit = ipRateLimit({
    prefix: 'rl:pwreset:ip:',
    windowMs: HOUR,
    max: envInt('PASSWORD_RESET_IP_MAX_PER_HOUR', 10),
    message: 'Too many reset requests from this network. Please wait a while and try again.',
});

// --- Sign-up honeypot + minimum fill time -------------------------------------

/** A hidden form field real users never see; only a dumb bot fills it in. */
const HONEYPOT_FIELD = 'website';
const MIN_FILL_MS = envInt('SIGNUP_MIN_FILL_MS', 2500);
const MAX_TOKEN_AGE_MS = envInt('SIGNUP_TOKEN_MAX_AGE_MS', HOUR);
/** When true, a sign-up with no valid form token is rejected (turn on once the frontend ships the token). */
const TOKEN_REQUIRED = process.env.SIGNUP_BOT_CHECK_REQUIRED === 'true';

function challengeSecret(): string {
    return process.env.BOT_CHECK_SECRET || (config.jwt.secret as string);
}

function sign(issuedAtMs: number): string {
    return createHmac('sha256', challengeSecret()).update(String(issuedAtMs)).digest('hex');
}

/** A short-lived token that proves the form was fetched before it was submitted. */
export function issueSignupChallenge(_req: Request, res: Response): Response {
    const issuedAt = Date.now();
    return res.json({
        success: true,
        data: { token: `v1.${issuedAt}.${sign(issuedAt)}`, minFillMs: MIN_FILL_MS },
    });
}

type TokenCheck = 'ok' | 'missing' | 'malformed' | 'bad_signature' | 'too_fast' | 'expired';

function checkFormToken(token: unknown): TokenCheck {
    if (typeof token !== 'string' || token.length === 0) return 'missing';
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return 'malformed';
    const issuedAt = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(issuedAt)) return 'malformed';
    const expected = sign(issuedAt);
    const got = parts[2];
    // timingSafeEqual throws on length mismatch — guard first so a wrong length isn't an error.
    if (got.length !== expected.length) return 'bad_signature';
    if (!timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return 'bad_signature';
    const age = Date.now() - issuedAt;
    if (age < MIN_FILL_MS) return 'too_fast';
    if (age > MAX_TOKEN_AGE_MS) return 'expired';
    return 'ok';
}

function rejectAsBot(res: Response, reason: string, req: Request): Response {
    logger.warn(`Sign-up rejected (${reason}) from ${clientIpOf(req) ?? 'unknown IP'}`);
    return res.status(400).json({
        success: false,
        error: 'Could not complete sign-up. Please reload the page and try again.',
        errorCode: 'SIGNUP_REJECTED',
    });
}

/**
 * Runs BEFORE validation (which strips unknown fields) so it can see the raw body.
 * A filled honeypot is always a bot. A form token is verified whenever one is sent;
 * a missing token is rejected only when TOKEN_REQUIRED is on, so existing API
 * clients and tests keep working until the frontend ships the token.
 */
export function signupHumanCheck(req: Request, res: Response, next: NextFunction): Response | void {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const honeypot = body[HONEYPOT_FIELD];
    if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
        return rejectAsBot(res, 'honeypot', req);
    }

    const token = body.formToken;
    const result = checkFormToken(token);
    if (result === 'missing') {
        if (TOKEN_REQUIRED) return rejectAsBot(res, 'missing form token', req);
        return next();
    }
    if (result !== 'ok') return rejectAsBot(res, `form token ${result}`, req);
    return next();
}
