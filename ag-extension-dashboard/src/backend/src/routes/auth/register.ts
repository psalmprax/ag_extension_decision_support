import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { registerSchema } from '@/utils/schemas';
import { safeError } from '@/utils/safeResponse';
import { passwordProblems } from '@/utils/passwordPolicy';
import { issueEmailVerification } from './passwordReset';
import { incrWindow } from '@/services/sharedState';
import { createSession } from '@/services/sessionService';
import { resolveLocationFromHeaders } from '@/services/loginHistoryService';
import { setAuthCookie } from '@/middleware/authCookie';
import { buildUserProfileColumns } from '@/services/userQueryBuilder';
import { resolveRegionalManager } from '@/services/regionalManagerResolver';
import { joinNewUserTenant } from '@/services/newUserTenant';
import { signSessionToken } from '@/utils/sessionToken';
import { findCountry } from '@/shared-api/countries';
import { toE164 } from '@/services/country/phone';
import { clientIpOf } from '@/utils/clientIp';

const router = Router();

/** Shared helper — create or reset a Free subscription + usage row for a user. */
async function createFreeSubscription(userId: string): Promise<void> {
    try {
        const freePlan = await query("SELECT id FROM subscription_plans WHERE name = 'Free' OR LOWER(name) = 'free' ORDER BY price ASC LIMIT 1");
        if (freePlan.rows.length > 0) {
            const planId = freePlan.rows[0].id;
            const now = new Date();
            const nextMonth = new Date();
            nextMonth.setMonth(now.getMonth() + 1);

            const subResult = await query(`
                INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
                VALUES ($1, $2, 'active', $3, $4, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET plan_id = $2, updated_at = NOW()
                RETURNING id
            `, [userId, planId, now, nextMonth]);

            if (subResult.rows.length > 0) {
                await query(`
                    INSERT INTO usage (subscription_id, sms_count, ai_chat_count, report_count, last_reset_at, created_at, updated_at)
                    VALUES ($1, 0, 0, 0, NOW(), NOW(), NOW())
                    ON CONFLICT (subscription_id) DO NOTHING
                `, [subResult.rows[0].id]);
            }
        }
    } catch (subError) {
        logger.error('Failed to auto-subscribe user:', subError);
        // Non-fatal — user account exists, subscription can be fixed later
    }
}

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
        const { email, password, firstName, lastName, role, region, country, phone, phoneNumber } = req.body;

        // SECURITY: Prevent self-registration as admin — admin accounts are internal-only
        const allowedRoles = ['extension_officer', 'farmer'];
        if (role && !allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                error: `Role "${role}" is not available for self-registration.`,
            });
        }

        const accountRole: string = role || 'extension_officer';
        const accountRegion: string | null = region?.trim() || null;
        const accountCountry: string | null = findCountry(country)?.name ?? (country?.trim() || null);
        // Older clients sent `phoneNumber`; validation accepts both, the column is `phone`.
        const rawPhone: string | null = (phone ?? phoneNumber ?? '').trim() || null;
        const accountPhone: string | null = rawPhone ? toE164(rawPhone, accountCountry) : null;
        if (rawPhone && !accountPhone) {
            return res.status(400).json({ success: false, error: `That phone number is not valid for ${accountCountry ?? 'your country'}.`, errorCode: 'INVALID_PHONE' });
        }

        const problems = passwordProblems(password, email);
        if (problems.length > 0) {
            return res.status(400).json({ success: false, error: `Password must have ${problems.join(', ')}`, errorCode: 'WEAK_PASSWORD' });
        }

        // Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered',
            });
        }

        // An officer is linked to the regional manager who owns their region.
        // Farmers are enrolled by an officer later, so they carry no manager.
        const managerResolution = accountRole === 'extension_officer'
            ? await resolveRegionalManager(accountRegion, accountCountry)
            : { managerId: null, matchedBy: 'none' as const, matchedRegion: null };

        // Store the manager's own region spelling. Region-scoped queries compare
        // exact strings, so an officer who signed up with the country-list
        // spelling must not end up outside their manager's scope. Unmatched
        // regions keep what the form sent and an administrator links them later.
        const storedRegion = managerResolution.matchedRegion ?? accountRegion;

        if (accountRole === 'extension_officer' && !managerResolution.managerId) {
            logger.info(
                `Registration for ${email}: no regional manager matched region "${accountRegion ?? 'unspecified'}" in ${accountCountry ?? 'unspecified country'}; the account needs an administrator to link it.`
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Save to database (email unverified until the link in the welcome mail is clicked)
        const result = await query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, region, country, phone, manager_id, email_verified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW())
            RETURNING ${buildUserProfileColumns()}
        `, [
            email, passwordHash, firstName, lastName, accountRole, storedRegion, accountCountry,
            accountPhone, managerResolution.managerId,
        ]);

        const newUser = result.rows[0];

        // Assign Free Subscription Plan
        await createFreeSubscription(newUser.id);

        // Verification mail is best-effort: registration must not fail if SMTP is down.
        issueEmailVerification(newUser.id, newUser.email).catch(err =>
            logger.warn(`Verification email for ${newUser.id} could not be sent:`, err)
        );

        // Generate JWT token
        const token = signSessionToken({ userId: newUser.id, email: newUser.email, role: newUser.role });

        // Record initial user session for active session visibility and revocation support
        const clientIp = clientIpOf(req);
        // Awaited: in production a token with no session row is refused, so the first request
        // after registering must not race the insert.
        await createSession({
            userId: newUser.id,
            token,
            ipAddress: clientIp,
            userAgent: req.get('user-agent') || null,
            location: resolveLocationFromHeaders(req.headers, clientIp, newUser.region),
        }).catch(err => logger.warn(`Session for new user ${newUser.id} could not be persisted:`, err));

        // An officer works in their regional manager's organisation; without one they could
        // not open any farmer, even those their manager assigns to them.
        await joinNewUserTenant((text, params) => query<{ tenant_id: string | null }>(text, params), newUser.id, {
            managerId: managerResolution.managerId,
        });

        setAuthCookie(res, token);

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
                    country: accountCountry,
                    phone: newUser.phone ?? accountPhone,
                    emailVerified: false,
                },
                managerAssigned: managerResolution.managerId !== null,
            },
            message: 'Account created. Check your inbox to verify your email address.',
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
// Demo endpoint rate limit (per IP), shared across replicas via sharedState
const DEMO_RATE_LIMIT = 100; // max attempts per window
const DEMO_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

router.post('/demo', async (req: Request, res: Response) => {
    if (!config.demo.enabled) {
        return res.status(404).json({ success: false, error: 'Demo access is not enabled' });
    }

    // Rate limit by IP
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const { count } = await incrWindow(`demo-login:${ip}`, DEMO_RATE_WINDOW);
    if (count > DEMO_RATE_LIMIT) {
        return res.status(429).json({ success: false, error: 'Too many demo attempts. Try again later.' });
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
                RETURNING ${buildUserProfileColumns()}
            `, [email, passwordHash, 'Demo', 'User', 'extension_officer', 'Kenya', '+254700000000']);
            
            user = insertResult.rows[0];
        } else {
            // Re-assert the demo origin flag in case it drifted/missing on legacy rows.
            await query('UPDATE users SET is_demo = true, updated_at = NOW() WHERE id = $1', [user.id]);
        }

        await createFreeSubscription(user.id);

        

        const token = signSessionToken({ userId: user.id, email: user.email, role: user.role });

        // Awaited: in production a token with no session row is refused, so the first request
        // after registering must not race the insert.
        await createSession({
            userId: user.id,
            token,
            ipAddress: ip,
            userAgent: req.get('user-agent') || null,
            location: resolveLocationFromHeaders(req.headers, ip, user.region),
        }).catch(err => logger.warn(`Session for demo user ${user.id} could not be persisted:`, err));

        setAuthCookie(res, token);

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
                    planName: 'Free',
                    isFree: true,
                },
            },
        });
    } catch (error) {
        logger.error('Demo login error:', error);
        safeError(res, 500, 'Demo login failed');
    }
});

export default router;
