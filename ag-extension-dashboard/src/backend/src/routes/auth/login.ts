import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { loginSchema } from '@/utils/schemas';
import { recordLoginAttempt, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { isAccountLocked, recordFailedLogin, resetFailedAttempts } from '@/services/lockoutService';
import { verifyPassword } from '@/utils/password';
import { safeError } from '@/utils/safeResponse';
import { finishSignIn, type LoginUserRow } from './loginCompletion';
import { clientIpOf } from '@/utils/clientIp';

const router = Router();

// Fixed pre-computed bcrypt hash to neutralize authentication timing side-channels (user enumeration)
const DUMMY_BCRYPT_HASH = '$2a$10$NVqK3ijujMkE3ZwVVOLruutAEJwLmNCDXAGVKvTqLGxhBpNeLz.BO';

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
        const clientIp = clientIpOf(req);

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
        const result = await query<LoginUserRow>('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
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

        // Check password. verifyPassword never throws: a missing or malformed
        // hash fails closed as invalid credentials (401), never a 500.
        const isPasswordValid = await verifyPassword(password, user.password_hash);
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

        // Optional hard gate: REQUIRE_EMAIL_VERIFICATION=true blocks sign-in until the
        // address is confirmed. Accounts created before the feature were grandfathered
        // as verified by the migration, so enabling this never locks out existing users.
        if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && user.email_verified === false) {
            return res.status(403).json({
                success: false,
                error: 'Please verify your email address before signing in. Check your inbox for the verification link.',
                errorCode: 'EMAIL_NOT_VERIFIED',
            });
        }

        await finishSignIn(req, res, user, clientIp);
    } catch (error) {
        logger.error('Login error:', error);
        safeError(res, 500, 'Login failed');
    }
});

export default router;
