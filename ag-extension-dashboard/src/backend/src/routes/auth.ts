import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { loginSchema, registerSchema } from '@/utils/schemas';
import { safeError } from '@/utils/safeResponse';
import { recordLoginAttempt, getLoginHistory, getLoginStats } from '@/services/loginHistoryService';

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

        if (!email || !password) {
            await recordLoginAttempt({
                email: email || 'unknown',
                status: 'failed',
                failureReason: 'missing_credentials',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
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
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            await recordLoginAttempt({
                userId: user.id,
                email,
                status: 'failed',
                failureReason: 'invalid_password',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }

        // Record successful login
        await recordLoginAttempt({
            userId: user.id,
            email: user.email,
            status: 'success',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            config.jwt.secret as jwt.Secret,
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

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

export default router;
