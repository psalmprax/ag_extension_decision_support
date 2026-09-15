import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { recordLoginAttempt, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { generateMfaSecret, matchTotpStep, verifyAndConsumeBackupCode, hashBackupCodes } from '@/services/mfaService';
import { createSession } from '@/services/sessionService';
import { setAuthCookie } from '@/middleware/authCookie';
import { isAccountLocked, recordFailedLogin, resetFailedAttempts } from '@/services/lockoutService';
import { setWithTtl, getTtl, delKey } from '@/services/sharedState';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/** Pending /mfa/setup enrollments expire after 10 minutes (Redis TTL). */
const MFA_PENDING_TTL_MS = 10 * 60 * 1000;

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * POST /api/v1/auth/mfa/verify
 * Complete 2FA login challenge with TOTP code or backup code.
 */
router.post('/mfa/verify', async (req: Request, res: Response) => {
    try {
        const { tempToken, code, isBackupCode } = req.body;
        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || null;

        if (!tempToken || !code) {
            return res.status(400).json({ success: false, error: 'tempToken and code are required' });
        }

        let decoded: { userId: string; email: string; mfaPending?: boolean };
        try {
            decoded = jwt.verify(tempToken, config.jwt.secret as jwt.Secret, { algorithms: ['HS256'] }) as typeof decoded;
        } catch {
            return res.status(401).json({ success: false, error: 'Invalid or expired MFA token' });
        }

        if (!decoded.mfaPending) {
            return res.status(400).json({ success: false, error: 'Invalid token type for MFA challenge' });
        }

        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
        const user = userRes.rows[0];
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // MFA challenges share the account lockout counter with password login so
        // a 6-digit TOTP cannot be brute-forced within the tempToken lifetime.
        const lockoutStatus = isAccountLocked(user.lockout_until);
        if (lockoutStatus.locked) {
            return res.status(423).json({
                success: false,
                error: `Account is temporarily locked. Please try again in ${lockoutStatus.remainingSeconds} seconds.`,
                lockoutRemainingSeconds: lockoutStatus.remainingSeconds,
            });
        }

        let isValid = false;
        let failureReasonOverride: string | null = null;
        if (isBackupCode) {
            const backupRes = await verifyAndConsumeBackupCode(user.id, code, user.mfa_backup_codes || []);
            isValid = backupRes.valid;
        } else {
            const step = matchTotpStep(code, user.mfa_secret);
            if (step !== null) {
                // Replay guard: a code is single-use. Reject anything at or before the last
                // accepted step, then advance the watermark atomically.
                const lastStep = user.last_totp_step !== null && user.last_totp_step !== undefined ? Number(user.last_totp_step) : -1;
                if (step <= lastStep) {
                    failureReasonOverride = 'totp_code_replayed';
                } else {
                    const claim = await query(
                        `UPDATE users SET last_totp_step = $1 WHERE id = $2 AND (last_totp_step IS NULL OR last_totp_step < $1) RETURNING id`,
                        [step, user.id]
                    );
                    isValid = claim.rows.length > 0;
                    if (!isValid) failureReasonOverride = 'totp_code_replayed';
                }
            }
        }

        if (!isValid) {
            const failedInfo = await recordFailedLogin(user.id);
            await recordLoginAttempt({
                userId: user.id,
                email: user.email,
                status: 'failed',
                failureReason: failureReasonOverride ?? (isBackupCode ? 'invalid_backup_code' : 'invalid_totp_code'),
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
            });
            return res.status(401).json({
                success: false,
                error: failureReasonOverride === 'totp_code_replayed'
                    ? 'That code was already used. Wait for the next code.'
                    : failedInfo.locked
                    ? 'Too many invalid codes. Account temporarily locked.'
                    : `Invalid verification code. ${failedInfo.remainingAttempts} attempt(s) remaining.`,
                remainingAttempts: failedInfo.remainingAttempts,
            });
        }

        await resetFailedAttempts(user.id);

        // Record successful login
        await recordLoginAttempt({
            userId: user.id,
            email: user.email,
            status: 'success',
            ipAddress: clientIp,
            userAgent: req.get('user-agent'),
            location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
        });

        // Generate full JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            config.jwt.secret as jwt.Secret,
            { algorithm: 'HS256', expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        // Create active user session
        await createSession({
            userId: user.id,
            token,
            ipAddress: clientIp,
            userAgent: req.get('user-agent'),
            location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
        });

        setAuthCookie(res, token);

        let planName = 'Free';
        try {
            const subResult = await query(`
                SELECT COALESCE(sp.name, 'Free') as plan_name
                FROM subscriptions s
                JOIN subscription_plans sp ON sp.id = s.plan_id
                WHERE s.user_id = $1
            `, [user.id]);
            if (subResult.rows.length > 0) {
                planName = subResult.rows[0].plan_name;
            }
        } catch {
            // fallback
        }

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
                    region: user.region,
                    mfaEnabled: true,
                    planName,
                    isFree: planName.toLowerCase() === 'free',
                },
            },
        });
    } catch (error) {
        logger.error('MFA verify error:', error);
        safeError(res, 500, 'MFA verification failed');
    }
});

/**
 * Resolve the caller from a Bearer JWT, rejecting anything not signed HS256.
 * Returns null when the header is missing or the token is invalid/expired.
 */
function authenticateBearer(req: Request): JWTPayload | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(authHeader.split(' ')[1], config.jwt.secret as jwt.Secret, { algorithms: ['HS256'] }) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * POST /api/v1/auth/mfa/setup
 * Generate a TOTP secret + backup codes, persist them as a pending enrollment,
 * and return the plaintext set once for the user to record.
 *
 * The secret is generated and stored server-side. /mfa/enable verifies against the
 * stored secret, so a client can never nominate the enrolled secret for the account.
 */
router.post('/mfa/setup', async (req: Request, res: Response) => {
    const decoded = authenticateBearer(req);
    if (!decoded) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const userRes = await query('SELECT mfa_enabled FROM users WHERE id = $1', [decoded.userId]);
        const user = userRes.rows[0];
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (user.mfa_enabled) {
            // Never allow an existing 2FA enrollment to be overwritten from a session:
            // that would let a stolen JWT rebind an attacker's authenticator. Disabling
            // 2FA is password-gated, so rotation must go through disable -> setup.
            return res.status(409).json({
                success: false,
                error: 'Two-factor authentication is already enabled. Disable it before enrolling a new authenticator.',
            });
        }

        const setup = generateMfaSecret(decoded.email, 'AgriExtension');

        // Persist the pending enrollment server-side: a Redis key with a 10-minute TTL
        // (process-local fallback keeps single-node/dev deployments working). The users
        // table is only written on /mfa/enable success, so an abandoned setup leaves no
        // enrollment on the account. Only the hashed backup codes are stored — the
        // plaintext set is returned exactly once here and never persisted.
        await setWithTtl(
            `mfa:pending:${decoded.userId}`,
            JSON.stringify({ secret: setup.secret, backupCodes: hashBackupCodes(setup.backupCodes) }),
            MFA_PENDING_TTL_MS
        );

        res.json({
            success: true,
            data: setup,
        });
    } catch (error) {
        logger.error('MFA setup error:', error);
        res.status(500).json({ success: false, error: 'Failed to start 2FA setup' });
    }
});

/**
 * POST /api/v1/auth/mfa/enable
 * Confirm the code from the pending enrollment and activate 2FA.
 *
 * Only `code` is accepted. The secret and backup codes were generated and persisted
 * by /mfa/setup; accepting either from the client would let a stolen JWT bind an
 * attacker-chosen authenticator (and attacker-chosen backup codes) to the account.
 */
router.post('/mfa/enable', async (req: Request, res: Response) => {
    const decoded = authenticateBearer(req);
    if (!decoded) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const code = String(req.body?.code ?? req.body?.totpCode ?? '').trim();
        if (!code) {
            return res.status(400).json({ success: false, error: 'code is required' });
        }

        const userRes = await query('SELECT mfa_enabled FROM users WHERE id = $1', [decoded.userId]);
        const user = userRes.rows[0];
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (user.mfa_enabled) {
            return res.status(409).json({ success: false, error: 'Two-factor authentication is already enabled.' });
        }

        // Verify against the SERVER-side pending enrollment from /mfa/setup. Only `code`
        // is accepted: the secret and backup codes are never taken from the client, so a
        // stolen JWT cannot bind an attacker-chosen authenticator to the account.
        const pendingRaw = await getTtl(`mfa:pending:${decoded.userId}`);
        if (!pendingRaw) {
            return res.status(400).json({
                success: false,
                error: 'No pending 2FA setup found (or it expired). Call /mfa/setup again.',
            });
        }

        let pending: { secret: string; backupCodes: string[] };
        try {
            const parsed = JSON.parse(pendingRaw) as { secret?: unknown; backupCodes?: unknown };
            if (typeof parsed.secret !== 'string' || !Array.isArray(parsed.backupCodes)) {
                throw new Error('invalid pending enrollment payload');
            }
            pending = {
                secret: parsed.secret,
                backupCodes: parsed.backupCodes.filter((c): c is string => typeof c === 'string'),
            };
        } catch {
            // Corrupt entry: drop it so the next /mfa/setup starts clean.
            await delKey(`mfa:pending:${decoded.userId}`);
            return res.status(400).json({ success: false, error: 'Pending 2FA setup is invalid. Call /mfa/setup again.' });
        }

        const step = matchTotpStep(code, pending.secret);
        if (step === null) {
            return res.status(400).json({ success: false, error: 'Invalid verification code' });
        }

        // Promote the pending enrollment into the account and record the enrollment step
        // as the replay watermark so the code used to enable 2FA cannot be replayed at
        // the first login challenge. The conditional UPDATE keeps a concurrent second
        // enable from double-writing.
        const claim = await query(
            `
            UPDATE users
            SET mfa_secret = $1,
                mfa_backup_codes = $2,
                mfa_enabled = true,
                last_totp_step = $3
            WHERE id = $4 AND mfa_enabled = false
            RETURNING id
        `,
            [pending.secret, pending.backupCodes, step, decoded.userId]
        );
        if (claim.rows.length === 0) {
            return res.status(409).json({ success: false, error: 'Two-factor authentication is already enabled.' });
        }

        await delKey(`mfa:pending:${decoded.userId}`);

        res.json({
            success: true,
            message: 'Two-factor authentication successfully enabled',
        });
    } catch (error) {
        logger.error('MFA enable error:', error);
        res.status(500).json({ success: false, error: 'Failed to enable 2FA' });
    }
});

/**
 * POST /api/v1/auth/mfa/disable
 * Disable 2FA after password confirmation.
 */
router.post('/mfa/disable', async (req: Request, res: Response) => {
    const decoded = authenticateBearer(req);
    if (!decoded) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, error: 'Password is required to disable 2FA' });
        }

        const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [decoded.userId]);
        const user = userRes.rows[0];
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }

        await query(
            `
            UPDATE users
            SET mfa_enabled = false,
                mfa_secret = NULL,
                mfa_backup_codes = '{}',
                last_totp_step = NULL
            WHERE id = $1
        `,
            [decoded.userId]
        );
        // Drop any pending enrollment so it cannot be confirmed after a disable.
        await delKey(`mfa:pending:${decoded.userId}`);

        res.json({
            success: true,
            message: 'Two-factor authentication disabled',
        });
    } catch (error) {
        logger.error('MFA disable error:', error);
        res.status(500).json({ success: false, error: 'Failed to disable 2FA' });
    }
});

export default router;
