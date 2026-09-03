import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { recordLoginAttempt, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { generateMfaSecret, verifyTotp, verifyAndConsumeBackupCode } from '@/services/mfaService';
import { createSession } from '@/services/sessionService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

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
            decoded = jwt.verify(tempToken, config.jwt.secret as jwt.Secret) as typeof decoded;
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

        let isValid = false;
        if (isBackupCode) {
            const backupRes = await verifyAndConsumeBackupCode(user.id, code, user.mfa_backup_codes || []);
            isValid = backupRes.valid;
        } else {
            isValid = verifyTotp(code, user.mfa_secret);
        }

        if (!isValid) {
            await recordLoginAttempt({
                userId: user.id,
                email: user.email,
                status: 'failed',
                failureReason: isBackupCode ? 'invalid_backup_code' : 'invalid_totp_code',
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
            });
            return res.status(401).json({ success: false, error: 'Invalid verification code' });
        }

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
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        // Create active user session
        await createSession({
            userId: user.id,
            token,
            ipAddress: clientIp,
            userAgent: req.get('user-agent'),
            location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
        });

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
 * POST /api/v1/auth/mfa/setup
 * Generate a new TOTP secret, backup codes, and QR auth URL.
 */
router.post('/mfa/setup', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const setup = generateMfaSecret(decoded.email, 'AgriExtension');
        res.json({
            success: true,
            data: setup,
        });
    } catch (error) {
        logger.error('MFA setup error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

/**
 * POST /api/v1/auth/mfa/enable
 * Confirm verification code and activate 2FA for the account.
 */
router.post('/mfa/enable', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;
        const { secret, code, backupCodes } = req.body;

        if (!secret || !code || !Array.isArray(backupCodes)) {
            return res.status(400).json({ success: false, error: 'secret, code, and backupCodes are required' });
        }

        const isValid = verifyTotp(code, secret);
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid verification code' });
        }

        await query(
            `
            UPDATE users
            SET mfa_enabled = true,
                mfa_secret = $1,
                mfa_backup_codes = $2
            WHERE id = $3
        `,
            [secret, backupCodes, decoded.userId]
        );

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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;
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
                mfa_backup_codes = '{}'
            WHERE id = $1
        `,
            [decoded.userId]
        );

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
