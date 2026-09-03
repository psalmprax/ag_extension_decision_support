import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { loginSchema } from '@/utils/schemas';
import { recordLoginAttempt, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { isAccountLocked, recordFailedLogin, resetFailedAttempts } from '@/services/lockoutService';
import { createSession } from '@/services/sessionService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', [auditMiddleware('auth_login'), validate(loginSchema)], async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || null;

        if (!email || !password) {
            await recordLoginAttempt({
                email: email || 'unknown',
                status: 'failed',
                failureReason: 'missing_credentials',
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                location: resolveLocationFromHeaders(req.headers, clientIp),
            });
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        // Get user from database
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            await recordLoginAttempt({
                email,
                status: 'failed',
                failureReason: 'user_not_found',
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                location: resolveLocationFromHeaders(req.headers, clientIp),
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }

        // Check for temporary account lockout
        const lockoutStatus = isAccountLocked(user.lockout_until);
        if (lockoutStatus.locked) {
            await recordLoginAttempt({
                userId: user.id,
                email,
                status: 'failed',
                failureReason: 'account_locked',
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
            });
            return res.status(423).json({
                success: false,
                error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${lockoutStatus.remainingSeconds} seconds.`,
                lockoutRemainingSeconds: lockoutStatus.remainingSeconds,
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            const failedInfo = await recordFailedLogin(user.id);
            await recordLoginAttempt({
                userId: user.id,
                email,
                status: 'failed',
                failureReason: 'invalid_password',
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                location: resolveLocationFromHeaders(req.headers, clientIp, user.region),
            });
            return res.status(401).json({
                success: false,
                error: failedInfo.locked
                    ? 'Account has been temporarily locked for 15 minutes due to 5 consecutive failed login attempts.'
                    : `Invalid email or password. ${failedInfo.remainingAttempts} attempt(s) remaining before temporary lockout.`,
                remainingAttempts: failedInfo.remainingAttempts,
                isLocked: failedInfo.locked,
            });
        }

        // Reset failed login attempts on valid password
        await resetFailedAttempts(user.id);

        // Check if MFA is required
        if (user.mfa_enabled) {
            const tempToken = jwt.sign(
                { userId: user.id, email: user.email, mfaPending: true },
                config.jwt.secret as jwt.Secret,
                { expiresIn: '5m' }
            );
            return res.json({
                success: true,
                data: {
                    mfaRequired: true,
                    tempToken,
                    message: 'Two-factor authentication required. Please enter your 6-digit TOTP code or a backup code.',
                },
            });
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

        // Generate JWT token
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
                    mfaEnabled: !!user.mfa_enabled,
                    planName,
                    isFree: planName.toLowerCase() === 'free',
                },
            },
        });
    } catch (error) {
        logger.error('Login error:', error);
        safeError(res, 500, 'Login failed');
    }
});

export default router;
