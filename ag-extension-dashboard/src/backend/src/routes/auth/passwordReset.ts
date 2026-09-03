import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } from '@/utils/schemas';
import { passwordProblems } from '@/utils/passwordPolicy';
import { emailService } from '@/services/emailService';
import { revokeAllUserSessions } from '@/services/sessionService';
import { safeError } from '@/utils/safeResponse';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { auditMiddleware } from '@/middleware/auditMiddleware';

const router = Router();

const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Tokens are random 32 bytes; only the sha256 is persisted. */
export function newToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(32).toString('hex');
    return { raw, hash: hashToken(raw) };
}
export function hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

const GENERIC_FORGOT_RESPONSE = {
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
};

/**
 * POST /auth/forgot-password
 * Always responds 200 with the same body so it cannot be used to enumerate accounts.
 */
router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response) => {
    const email = String(req.body.email).trim().toLowerCase();
    try {
        const userRes = await query<{ id: string; first_name: string }>(
            'SELECT id, first_name FROM users WHERE LOWER(email) = $1 AND is_active IS NOT FALSE LIMIT 1',
            [email]
        );
        const user = userRes.rows[0];
        if (user) {
            const { raw, hash } = newToken();
            await query(
                'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
                [hash, new Date(Date.now() + RESET_TTL_MS), user.id]
            );
            const sent = await emailService.sendPasswordResetEmail(email, raw);
            if (!sent) {
                logger.error(`Password reset email could not be sent to user ${user.id} (SMTP unavailable)`);
            }
        } else {
            // Constant-ish timing: hash something anyway.
            hashToken(email);
        }
    } catch (error) {
        logger.error('forgot-password failed:', error);
    }
    return res.json(GENERIC_FORGOT_RESPONSE);
});

/**
 * POST /auth/reset-password { token, password }
 * Consumes the token, sets the new password, and revokes every existing session.
 */
router.post('/reset-password', validate(resetPasswordSchema), auditMiddleware('auth.password_reset'), async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body as { token: string; password: string };
        const userRes = await query<{ id: string; email: string; reset_token_expires: string | Date | null }>(
            'SELECT id, email, reset_token_expires FROM users WHERE reset_token = $1 LIMIT 1',
            [hashToken(token)]
        );
        const user = userRes.rows[0];
        if (!user || !user.reset_token_expires || new Date(user.reset_token_expires).getTime() < Date.now()) {
            return res.status(400).json({ success: false, error: 'Reset link is invalid or has expired', errorCode: 'RESET_TOKEN_INVALID' });
        }

        const problems = passwordProblems(password, user.email);
        if (problems.length > 0) {
            return res.status(400).json({ success: false, error: `Password must have ${problems.join(', ')}`, errorCode: 'WEAK_PASSWORD' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await query(
            `UPDATE users
                SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL,
                    failed_login_attempts = 0, lockout_until = NULL, updated_at = NOW()
              WHERE id = $2`,
            [passwordHash, user.id]
        );
        // A password reset is the canonical "I lost control of my account" action.
        await revokeAllUserSessions(user.id).catch(err => logger.warn('Session revocation after reset failed:', err));

        return res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
    } catch (error) {
        logger.error('reset-password failed:', error);
        return safeError(res, 500, 'Password reset failed');
    }
});

/**
 * POST /auth/verify-email { token }
 */
router.post('/verify-email', validate(verifyEmailSchema), async (req: Request, res: Response) => {
    try {
        const { token } = req.body as { token: string };
        const result = await query<{ id: string }>(
            `UPDATE users
                SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = NOW()
              WHERE email_verification_token = $1
                AND email_verification_expires IS NOT NULL
                AND email_verification_expires > NOW()
              RETURNING id`,
            [hashToken(token)]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Verification link is invalid or has expired', errorCode: 'VERIFY_TOKEN_INVALID' });
        }
        return res.json({ success: true, message: 'Email verified' });
    } catch (error) {
        logger.error('verify-email failed:', error);
        return safeError(res, 500, 'Email verification failed');
    }
});

/**
 * POST /auth/resend-verification (authenticated)
 */
router.post('/resend-verification', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const userRes = await query<{ email: string; email_verified: boolean }>('SELECT email, email_verified FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (user.email_verified) return res.json({ success: true, message: 'Email already verified' });
        await issueEmailVerification(userId, user.email);
        return res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        logger.error('resend-verification failed:', error);
        return safeError(res, 500, 'Could not resend verification email');
    }
});

/** Create + store a verification token and email the link. Used by register and resend. */
export async function issueEmailVerification(userId: string, email: string): Promise<boolean> {
    const { raw, hash } = newToken();
    await query(
        'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
        [hash, new Date(Date.now() + VERIFY_TTL_MS), userId]
    );
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/verify-email?token=${raw}`;
    return emailService.sendEmail({
        to: email,
        subject: 'Verify your GPExts email',
        html: `<h1>Confirm your email</h1><p>Click to verify your address:</p><a href="${verifyUrl}">Verify email</a><p>This link expires in 24 hours.</p>`,
        text: `Verify your email: ${verifyUrl} (expires in 24 hours)`,
    });
}

export default router;
