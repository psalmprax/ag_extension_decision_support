import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { loginSchema, registerSchema } from '@/utils/schemas';
import { recordLoginAttempt, getLoginHistory, getLoginStats, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { generateMfaSecret, verifyTotp, verifyAndConsumeBackupCode } from '@/services/mfaService';
import { isAccountLocked, recordFailedLogin, resetFailedAttempts } from '@/services/lockoutService';
import { createSession, revokeSession, revokeAllOtherSessions, getUserSessions } from '@/services/sessionService';

const router = Router();

/** Shared helper — create a Free subscription + usage row for a newly created user. */
async function createFreeSubscription(userId: string): Promise<void> {
    try {
        const freePlan = await query("SELECT id FROM subscription_plans WHERE name = 'Free'");
        if (freePlan.rows.length > 0) {
            const planId = freePlan.rows[0].id;
            const now = new Date();
            const nextMonth = new Date();
            nextMonth.setMonth(now.getMonth() + 1);

            const subResult = await query(`
                INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
                VALUES ($1, $2, 'active', $3, $4, NOW(), NOW())
                RETURNING id
            `, [userId, planId, now, nextMonth]);

            await query(`
                INSERT INTO usage (subscription_id, sms_count, ai_chat_count, report_count, last_reset_at, created_at, updated_at)
                VALUES ($1, 0, 0, 0, NOW(), NOW(), NOW())
            `, [subResult.rows[0].id]);
        }
    } catch (subError) {
        logger.error('Failed to auto-subscribe user:', subError);
        // Non-fatal — user account exists, subscription can be fixed later
    }
}

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

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: User registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Email already registered or invalid input
 */
router.post('/register', [auditMiddleware('auth_register'), validate(registerSchema)], async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName, role, region, phone } = req.body;

        // SECURITY: Prevent self-registration as admin — admin accounts are internal-only
        const allowedRoles = ['extension_officer', 'farmer'];
        if (role && !allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                error: `Role "${role}" is not available for self-registration.`,
            });
        }

        // Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered',
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Save to database
        const result = await query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id, email, first_name, last_name, role, region, phone
        `, [email, passwordHash, firstName, lastName, role || 'extension_officer', region, phone]);

        const newUser = result.rows[0];

        // Assign Free Subscription Plan
        await createFreeSubscription(newUser.id);

        // Generate JWT token
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, role: newUser.role },
            config.jwt.secret as jwt.Secret,
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        res.status(201).json({
            success: true,
            data: {
                token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    role: newUser.role,
                    region: newUser.region,
                },
            },
        });
    } catch (error) {
        logger.error('Registration error:', error);
        safeError(res, 500, 'Registration failed');
    }
});

/**
 * @swagger
 * /api/v1/auth/demo:
 *   post:
 *     summary: Demo login
 *     description: Automatically signs in as a demo user (creating the account if it does not exist) and returns a JWT session token. Perfect for quick API testing.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Demo login successful and token generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       500:
 *         description: Demo login failed
 */
// Simple in-memory rate limiter for demo endpoint (per IP)
const demoAttempts = new Map<string, { count: number; resetAt: number }>();
const DEMO_RATE_LIMIT = 100; // max attempts per window
const DEMO_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

router.post('/demo', async (req: Request, res: Response) => {
    if (!config.demo.enabled) {
        return res.status(404).json({ success: false, error: 'Demo access is not enabled' });
    }

    // Rate limit by IP
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = demoAttempts.get(ip);
    if (entry && now < entry.resetAt) {
        if (entry.count >= DEMO_RATE_LIMIT) {
            return res.status(429).json({ success: false, error: 'Too many demo attempts. Try again later.' });
        }
        entry.count++;
    } else {
        demoAttempts.set(ip, { count: 1, resetAt: now + DEMO_RATE_WINDOW });
    }
    try {
        const email = 'demo@agridemo.com';
        
        const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
        let user = userResult.rows[0];
        if (!user) {
            const passwordHash = await bcrypt.hash(config.demo.password, 10);
            const insertResult = await query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, created_at, is_demo)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), true)
                RETURNING id, email, first_name, last_name, role, region, phone
            `, [email, passwordHash, 'Demo', 'User', 'extension_officer', 'Kenya', '+254700000000']);
            
            user = insertResult.rows[0];
        } else {
            // Re-assert the demo origin flag in case it drifted/missing on legacy rows.
            await query('UPDATE users SET is_demo = true, updated_at = NOW() WHERE id = $1', [user.id]);
        }

        await createFreeSubscription(user.id);

        

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            config.jwt.secret as jwt.Secret,
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

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
                },
            },
        });
    } catch (error) {
        logger.error('Demo login error:', error);
        safeError(res, 500, 'Demo login failed');
    }
});

// Refresh token
router.post('/refresh', (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required',
            });
        }

        // Verify and refresh token
        const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret) as JWTPayload;

        const newToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, role: decoded.role },
            config.jwt.secret as jwt.Secret,
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        res.json({
            success: true,
            data: { token: newToken },
        });
    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Logout — clear auth on client side (server can't invalidate stateless JWT without a blocklist)
router.post('/logout', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
    // In production, verify JWT from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const result = await query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.region,
                   COALESCE(sp.name, 'Free') as plan_name,
                   COALESCE(s.status, 'active') as subscription_status
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
            WHERE u.id = $1
        `, [decoded.userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        const planName = user.plan_name || 'Free';

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
                isFree: planName.toLowerCase() === 'free',
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

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

/**
 * GET /api/v1/auth/sessions
 * List active sessions for the current user.
 */
router.get('/sessions', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const sessions = await getUserSessions(decoded.userId, token);
        res.json({
            success: true,
            data: sessions,
        });
    } catch (error) {
        logger.error('Failed to fetch sessions:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revoke a specific active session.
 */
router.delete('/sessions/:id', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const revoked = await revokeSession(req.params.id, decoded.userId);
        res.json({
            success: true,
            revoked,
            message: revoked ? 'Session revoked successfully' : 'Session not found or already revoked',
        });
    } catch (error) {
        logger.error('Failed to revoke session:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke session' });
    }
});

/**
 * POST /api/v1/auth/sessions/revoke-others
 * Revoke all other active sessions except the current one.
 */
router.post('/sessions/revoke-others', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;

        const count = await revokeAllOtherSessions(decoded.userId, token);
        res.json({
            success: true,
            count,
            message: `Revoked ${count} other active session(s)`,
        });
    } catch (error) {
        logger.error('Failed to revoke other sessions:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke other sessions' });
    }
});

export default router;
