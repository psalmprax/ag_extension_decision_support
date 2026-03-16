import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { loginSchema, registerSchema } from '@/utils/schemas';

const router = Router();

// Login
router.post('/login', [auditMiddleware('auth_login'), validate(loginSchema)], async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        // Get user from database
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }

        // Generate JWT token
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
        logger.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Register
router.post('/register', [auditMiddleware('auth_register'), validate(registerSchema)], async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName, role, region, phone } = req.body;

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
        try {
            const freePlan = await query("SELECT id FROM subscription_plans WHERE name = 'Free'");
            if (freePlan.rows.length > 0) {
                const planId = freePlan.rows[0].id;
                const now = new Date();
                const nextMonth = new Date();
                nextMonth.setMonth(now.getMonth() + 1);

                // Create subscription
                const subResult = await query(`
                    INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
                    VALUES ($1, $2, 'active', $3, $4, NOW(), NOW())
                    RETURNING id
                `, [newUser.id, planId, now, nextMonth]);

                const subId = subResult.rows[0].id;

                // Initialize usage
                await query(`
                    INSERT INTO usage (subscription_id, sms_count, ai_chat_count, report_count, last_reset_at, created_at, updated_at)
                    VALUES ($1, 0, 0, 0, NOW(), NOW(), NOW())
                `, [subId]);
            }
        } catch (subError) {
            logger.error('Failed to auto-subscribe user:', subError);
            // We continue as the user account is created, subscription can be fixed later
        }

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
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// Demo Login
router.post('/demo', async (req: Request, res: Response) => {
    try {
        const email = 'demo@agridemo.com';
        
        const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
        let user = userResult.rows[0];
        if (!user) {
            const passwordHash = await bcrypt.hash('demo-password-123', 10);
            const insertResult = await query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING id, email, first_name, last_name, role, region, phone
            `, [email, passwordHash, 'Demo', 'User', 'admin', 'Lilongwe', '+265880000000']);
            
            user = insertResult.rows[0];
        }

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
                    `, [user.id, planId, now, nextMonth]);

                    await query(`
                        INSERT INTO usage (subscription_id, sms_count, ai_chat_count, report_count, last_reset_at, created_at, updated_at)
                        VALUES ($1, 0, 0, 0, NOW(), NOW(), NOW())
                    `, [subResult.rows[0].id]);
                }
            } catch (err) {
                logger.error('Failed to skip demo subscription setup:', err);
            }
        

        const token = jwt.sign(
            { userId: user.id || user.id, email: user.email, role: user.role || user.role },
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
        res.status(500).json({ success: false, error: 'Demo login failed' });
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
        const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret) as any;

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

// Logout
router.post('/logout', (_req: Request, res: Response) => {
    // In production, invalidate token
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
        const decoded = jwt.verify(token, config.jwt.secret) as any;

        const result = await query('SELECT id, email, first_name, last_name, role, region FROM users WHERE id = $1', [decoded.userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                region: user.region,
            },
        });
    } catch {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

export default router;
