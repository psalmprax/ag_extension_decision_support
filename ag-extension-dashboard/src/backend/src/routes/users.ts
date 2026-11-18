import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, getPool } from '@/services/databaseService';
import type { CountRow, UserRow, UserPublicRow } from '@/types/rowTypes';
import { mapUserPublicRows, mapUserPublicRow, mapUserRows } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { revokeAllUserSessions } from '@/services/sessionService';
import { demoSql } from '@/services/demoScope';
import { validateRecordScope } from '@/services/demoRecordScope';
import { computeSubscriptionPeriodEnd } from '@/services/subscriptionUtils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PlanLookupRow {
    id: string;
    name: string;
    price: string | number;
    interval: string | null;
}

function extractOptionalPlanId(body: Record<string, unknown>): {
    provided: boolean;
    planId: string | null;
    error?: string;
} {
    const raw = body.planId ?? body.plan_id;
    if (raw === undefined || raw === null || raw === '') {
        return { provided: false, planId: null };
    }
    if (typeof raw !== 'string') {
        return { provided: true, planId: null, error: 'planId must be a string' };
    }
    const trimmed = raw.trim();
    if (!UUID_RE.test(trimmed)) {
        return { provided: true, planId: null, error: 'Invalid planId format' };
    }
    return { provided: true, planId: trimmed };
}

async function resolveActivePlan(planId: string): Promise<PlanLookupRow | null> {
    const { rows } = await query<PlanLookupRow>(
        `SELECT id, name, price, interval
         FROM subscription_plans
         WHERE id = $1 AND is_active = true`,
        [planId]
    );
    return rows[0] ?? null;
}

async function assignUserPlan(userId: string, plan: PlanLookupRow): Promise<{ periodEnd: Date }> {
    const now = new Date();
    const periodEnd = computeSubscriptionPeriodEnd(plan.interval, now);
    const existingRes = await query<{ id: string; plan_id: string; price?: string | number }>(
        `SELECT s.id, s.plan_id, sp.price
         FROM subscriptions s
         LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
         WHERE s.user_id = $1`,
        [userId]
    );
    const existing = existingRes.rows[0];
    const upserted = await query<{ id: string }>(
        `INSERT INTO subscriptions (
             user_id, plan_id, status, current_period_start, current_period_end,
             cancel_at_period_end, expiry_notification_sent, updated_at
         )
         VALUES ($1, $2, 'active', $3, $4, false, false, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET plan_id = EXCLUDED.plan_id,
               status = 'active',
               current_period_start = EXCLUDED.current_period_start,
               current_period_end = EXCLUDED.current_period_end,
               cancel_at_period_end = false,
               expiry_notification_sent = false,
               updated_at = NOW()
         RETURNING id`,
        [userId, plan.id, now, periodEnd]
    );
    const subscriptionId = upserted.rows[0]?.id;
    if (subscriptionId) {
        await query(
            `INSERT INTO usage (
                 subscription_id, sms_count, ai_chat_count, report_count,
                 ai_vision_count, speech_count, whatsapp_count, last_reset_at, updated_at
             )
             VALUES ($1, 0, 0, 0, 0, 0, 0, NOW(), NOW())
             ON CONFLICT (subscription_id) DO UPDATE
               SET last_reset_at = NOW(), updated_at = NOW()`,
            [subscriptionId]
        );
        if (existing && existing.plan_id !== plan.id) {
            await query(
                `INSERT INTO subscription_change_events (
                     subscription_id, from_plan_id, to_plan_id, from_price, to_price
                 )
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    subscriptionId,
                    existing.plan_id,
                    plan.id,
                    existing.price != null ? Number(existing.price) : 0,
                    plan.price != null ? Number(plan.price) : 0,
                ]
            );
        }
    }
    return { periodEnd };
}

function mergePlanIntoRow(row: UserPublicRow, plan: PlanLookupRow, periodEnd: Date): UserPublicRow {
    return {
        ...row,
        plan_id: plan.id,
        plan_name: plan.name,
        plan_price: plan.price,
        subscription_status: 'active',
        subscription_period_end: periodEnd,
    };
}

async function resolveRequestedPlan(body: Record<string, unknown>): Promise<{
    provided: boolean;
    plan: PlanLookupRow | null;
    error?: string;
}> {
    const planInput = extractOptionalPlanId(body);
    if (planInput.error) {
        return { provided: true, plan: null, error: planInput.error };
    }
    if (!planInput.provided || !planInput.planId) {
        return { provided: false, plan: null };
    }
    const plan = await resolveActivePlan(planInput.planId);
    if (!plan) {
        return { provided: true, plan: null, error: 'Subscription plan not found or inactive' };
    }
    return { provided: true, plan };
}

async function finalizeUserWithPlan(
    userRow: UserPublicRow | undefined,
    targetPlan: PlanLookupRow | null
) {
    if (!userRow) return null;
    const rowWithPlan = targetPlan
        ? mergePlanIntoRow(userRow, targetPlan, (await assignUserPlan(userRow.id, targetPlan)).periodEnd)
        : userRow;
    return mapUserPublicRow(rowWithPlan);
}

const router = Router();

router.use(authorize(['admin', 'regional_manager']));

function extractCreateUserData(body: Record<string, unknown>) {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rawFirst = body.firstName ?? body.first_name;
    const firstName = typeof rawFirst === 'string' ? rawFirst.trim() : '';
    const rawLast = body.lastName ?? body.last_name;
    const lastName = typeof rawLast === 'string' ? rawLast.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : 'extension_officer';
    const region = typeof body.region === 'string' && body.region.trim() ? body.region.trim() : null;
    const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : 'Kenya';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;

    const safeRole = role.toLowerCase();
    const normalizedRole = ALLOWED_ROLES.includes(safeRole) ? safeRole : 'extension_officer';

    return { email, password, firstName, lastName, normalizedRole, region, country, phone };
}

function isMissingColumnError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { message?: string; code?: string };
    return Boolean(e.message?.includes('country') || e.message?.includes('last_login_at') || e.code === '42703');
}

const USER_UPDATE_FIELD_MAP: Record<string, string> = {
    first_name: 'first_name',
    firstName: 'first_name',
    last_name: 'last_name',
    lastName: 'last_name',
    region: 'region',
    country: 'country',
    phone: 'phone',
    is_active: 'is_active',
    isActive: 'is_active',
    role: 'role',
};

const ALLOWED_ROLES = ['farmer', 'extension_officer', 'regional_manager', 'admin'];

/**
 * Validates role/activation updates in place. Returns an error message, or
 * null when the updates are acceptable.
 */
function validateSensitiveUserUpdates(
    safeUpdates: Record<string, unknown>,
    targetUserId: string,
    actingUserId: string | undefined
): string | null {
    if (safeUpdates.is_active !== undefined && typeof safeUpdates.is_active !== 'boolean') {
        return 'isActive must be a boolean';
    }
    if (safeUpdates.role !== undefined) {
        const role = typeof safeUpdates.role === 'string' ? safeUpdates.role.trim().toLowerCase() : '';
        if (!ALLOWED_ROLES.includes(role)) {
            return 'Invalid role';
        }
        safeUpdates.role = role;
        // An admin must not be able to demote themselves out of the last admin
        // seat mid-session; more importantly, self-demotion while holding a
        // still-valid admin JWT is confusing — require a second admin.
        if (actingUserId === targetUserId && role !== 'admin') {
            return 'Admins cannot change their own role';
        }
    }
    return null;
}

function extractSafeUserUpdates(body: Record<string, unknown>): Record<string, unknown> {
    const safeUpdates: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(USER_UPDATE_FIELD_MAP)) {
        if (body[key] !== undefined && safeUpdates[col] === undefined) {
            safeUpdates[col] = body[key];
        }
    }
    return safeUpdates;
}

async function executeUserUpdate(
    id: string,
    safeUpdates: Record<string, unknown>
): Promise<UserPublicRow[]> {
    try {
        const updateResult = await query<UserPublicRow>(
            `UPDATE users SET ${Object.keys(safeUpdates).map((k, i) => `${k} = $${i + 1}`).join(', ')}
              WHERE id = $${Object.keys(safeUpdates).length + 1}
          RETURNING id, email, first_name, last_name, role, region, country, phone, is_active,
                    avatar_url, created_at,
                    NULL::text AS preferred_language,
                    last_login_at AS last_login`,
            Object.values(safeUpdates).concat(id)
        );
        return updateResult.rows || [];
    } catch (dbErr: unknown) {
        if (!isMissingColumnError(dbErr)) throw dbErr;
        const filteredKeys = Object.keys(safeUpdates).filter(k => k !== 'country');
        const fallbackResult = await query<UserPublicRow>(
            `UPDATE users SET ${filteredKeys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
              WHERE id = $${filteredKeys.length + 1}
          RETURNING id, email, first_name, last_name, role, region, NULL::text AS country, phone, is_active,
                    avatar_url, created_at,
                    NULL::text AS preferred_language,
                    NULL::timestamp AS last_login`,
            filteredKeys.map(k => safeUpdates[k]).concat(id)
        );
        return fallbackResult.rows || [];
    }
}

async function fetchUserRowForPlanUpdate(id: string): Promise<UserPublicRow[]> {
    try {
        const res = await query<UserPublicRow>(
            `SELECT id, email, first_name, last_name, role, region, country, phone, is_active,
                    avatar_url, created_at,
                    NULL::text AS preferred_language,
                    last_login_at AS last_login,
                    COALESCE(is_demo, false) AS is_demo
             FROM users WHERE id = $1`,
            [id]
        );
        return res.rows || [];
    } catch (dbErr: unknown) {
        if (!isMissingColumnError(dbErr)) throw dbErr;
        const fallback = await query<UserPublicRow>(
            `SELECT id, email, first_name, last_name, role, region, NULL::text AS country, phone, is_active,
                    avatar_url, created_at,
                    NULL::text AS preferred_language,
                    NULL::timestamp AS last_login,
                    COALESCE(is_demo, false) AS is_demo
             FROM users WHERE id = $1`,
            [id]
        );
        return fallback.rows || [];
    }
}

/**
 * GET /api/users — list users (admin-only).
 */
router.get('/', validateRecordScope, async (req: Request, res: Response) => {
    try {
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        let rows: UserPublicRow[] = [];
        try {
            const queryRes = await query<UserPublicRow>(
                `SELECT users.id, users.email, users.first_name, users.last_name, users.role, users.region,
                        users.country, users.phone, users.is_active, users.avatar_url, users.created_at,
                        NULL::text AS preferred_language,
                        users.last_login_at AS last_login,
                        COALESCE(is_demo, false) AS is_demo,
                        sp.id AS plan_id,
                        sp.name AS plan_name,
                        sp.price AS plan_price,
                        s.status AS subscription_status,
                        s.current_period_end AS subscription_period_end
                 FROM users
                 LEFT JOIN subscriptions s ON s.user_id = users.id
                 LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
                 WHERE COALESCE(is_demo, false) = $1
                 ORDER BY users.created_at DESC`,
                [req.query.dataset === 'demo']
            );
            rows = queryRes.rows || [];
        } catch (dbErr: unknown) {
            if (isMissingColumnError(dbErr)) {
                logger.warn('users table lacks country or last_login_at column; selecting fallback');
                const fallbackRes = await query<UserPublicRow>(
                    `SELECT users.id, users.email, users.first_name, users.last_name, users.role, users.region,
                            NULL::text AS country, users.phone, users.is_active, users.avatar_url, users.created_at,
                            NULL::text AS preferred_language,
                            NULL::timestamp AS last_login,
                            COALESCE(is_demo, false) AS is_demo,
                            sp.id AS plan_id,
                            sp.name AS plan_name,
                            sp.price AS plan_price,
                            s.status AS subscription_status,
                            s.current_period_end AS subscription_period_end
                     FROM users
                     LEFT JOIN subscriptions s ON s.user_id = users.id
                     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
                     WHERE COALESCE(is_demo, false) = $1
                     ORDER BY users.created_at DESC`,
                    [req.query.dataset === 'demo']
                );
                rows = fallbackRes.rows || [];
            } else {
                throw dbErr;
            }
        }
        return res.json({ success: true, data: mapUserPublicRows(rows || []) });
    } catch (error) {
        logger.error('Failed to fetch users:', error);
        return safeError(res, 500, 'Failed to fetch users');
    }
});

/**
 * GET /api/users/:id — fetch a single user (admin-only).
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        // Admins see demo accounts (flagged) so they can manage them; nobody else does.
        const demoAccountsFilter = req.user?.role === 'admin' ? '' : `WHERE ${demoSql('users')}`;
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        let rows: UserPublicRow[] = [];
        try {
            const queryRes = await query<UserPublicRow>(
                `SELECT users.id, users.email, users.first_name, users.last_name, users.role, users.region,
                        users.country, users.phone, users.is_active, users.avatar_url, users.created_at,
                        NULL::text AS preferred_language,
                        users.last_login_at AS last_login,
                        COALESCE(is_demo, false) AS is_demo,
                        sp.id AS plan_id,
                        sp.name AS plan_name,
                        sp.price AS plan_price,
                        s.status AS subscription_status,
                        s.current_period_end AS subscription_period_end
                 FROM users
                 LEFT JOIN subscriptions s ON s.user_id = users.id
                 LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
                 WHERE users.id = $1 ${demoAccountsFilter.replace('WHERE', 'AND')}`,
                [id]
            );
            rows = queryRes.rows || [];
        } catch (dbErr: unknown) {
            if (isMissingColumnError(dbErr)) {
                logger.warn('users table lacks country or last_login_at column; selecting fallback');
                const fallbackRes = await query<UserPublicRow>(
                    `SELECT users.id, users.email, users.first_name, users.last_name, users.role, users.region,
                            NULL::text AS country, users.phone, users.is_active, users.avatar_url, users.created_at,
                            NULL::text AS preferred_language,
                            NULL::timestamp AS last_login,
                            sp.id AS plan_id,
                            sp.name AS plan_name,
                            sp.price AS plan_price,
                            s.status AS subscription_status,
                            s.current_period_end AS subscription_period_end
                     FROM users
                     LEFT JOIN subscriptions s ON s.user_id = users.id
                     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
                     WHERE users.id = $1 ${demoAccountsFilter.replace('WHERE', 'AND')}`,
                    [id]
                );
                rows = fallbackRes.rows || [];
            } else {
                throw dbErr;
            }
        }

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = rows[0];
        return res.json({ success: true, data: user ? mapUserPublicRow(user) : null });
    } catch (error) {
        logger.error('Failed to fetch user:', error);
        return safeError(res, 500, 'Failed to fetch user');
    }
});

function hasRequiredCreateFields(data: ReturnType<typeof extractCreateUserData>): boolean {
    return Boolean(data.email && data.password && data.firstName && data.lastName);
}

async function insertUserWithFallback(
    data: ReturnType<typeof extractCreateUserData>,
    passwordHash: string
): Promise<UserPublicRow[]> {
    try {
        const insertResult = await query<UserPublicRow>(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, region, country, phone, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, first_name, last_name, role, region, country, phone, is_active,
                       avatar_url, created_at,
                       NULL::text AS preferred_language,
                       NULL::timestamp AS last_login`,
            [data.email, passwordHash, data.firstName, data.lastName, data.normalizedRole, data.region, data.country, data.phone]
        );
        return insertResult.rows || [];
    } catch (dbErr: unknown) {
        if (!isMissingColumnError(dbErr)) throw dbErr;
        logger.warn('users table lacks country column; inserting without country');
        const fallbackResult = await query<UserPublicRow>(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, first_name, last_name, role, region, NULL::text AS country, phone, is_active,
                       avatar_url, created_at,
                       NULL::text AS preferred_language,
                       NULL::timestamp AS last_login`,
            [data.email, passwordHash, data.firstName, data.lastName, data.normalizedRole, data.region, data.phone]
        );
        return fallbackResult.rows || [];
    }
}

function validatePutPayload(
    safeUpdates: Record<string, unknown>,
    planResolution: { provided: boolean; error?: string },
    targetUserId: string,
    actingUserId: string | undefined
): string | null {
    if (planResolution.error) {
        return planResolution.error;
    }
    if (Object.keys(safeUpdates).length === 0 && !planResolution.provided) {
        return 'No valid updates supplied';
    }
    return validateSensitiveUserUpdates(safeUpdates, targetUserId, actingUserId);
}

async function applyUserUpdateOrFetch(
    id: string,
    safeUpdates: Record<string, unknown>
): Promise<UserPublicRow[]> {
    if (Object.keys(safeUpdates).length === 0) {
        return fetchUserRowForPlanUpdate(id);
    }
    safeUpdates.updated_at = new Date();
    return executeUserUpdate(id, safeUpdates);
}

/**
 * POST /api/users — create a user.
 */
router.post('/', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const body = (req.body || {}) as Record<string, unknown>;
        const data = extractCreateUserData(body);
        if (!hasRequiredCreateFields(data)) {
            return res.status(400).json({
                success: false,
                error: 'email, password, first name and last name are required',
            });
        }

        const planResolution = await resolveRequestedPlan(body);
        if (planResolution.error) {
            return res.status(400).json({ success: false, error: planResolution.error });
        }

        const passwordHash = await bcrypt.hash(data.password, 10);
        const rows = await insertUserWithFallback(data, passwordHash);
        if (rows.length === 0) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

        const dto = await finalizeUserWithPlan(rows[0], planResolution.plan);
        return res.status(201).json({ success: true, data: dto });
    } catch (error) {
        logger.error('Failed to create user:', error);
        return safeError(res, 500, 'Failed to create user');
    }
});

/**
 * PUT /api/users/:id — update a user.
 */
router.put('/:id', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const updates = (req.body || {}) as Record<string, unknown>;
        const safeUpdates = extractSafeUserUpdates(updates);
        const planResolution = await resolveRequestedPlan(updates);
        const payloadError = validatePutPayload(safeUpdates, planResolution, id, req.user?.userId);
        if (payloadError) {
            return res.status(400).json({ success: false, error: payloadError });
        }

        // Roles are embedded in the JWT, so a role change (demotion included) and
        // (re)activation must not leave previously issued tokens usable: revoke
        // every session so the user signs in again and gets the new claims.
        if (safeUpdates.is_active !== undefined || safeUpdates.role !== undefined) {
            await revokeAllUserSessions(id);
        }

        const rows = await applyUserUpdateOrFetch(id, safeUpdates);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const dto = await finalizeUserWithPlan(rows[0], planResolution.plan);
        return res.json({ success: true, data: dto });
    } catch (error) {
        logger.error('Failed to update user:', error);
        return safeError(res, 500, 'Failed to update user');
    }
});

/**
 * DELETE /api/users/:id — soft-delete a user.
 */
router.delete('/:id', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const { rows } = await query<CountRow>(
            'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await revokeAllUserSessions(id);
        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to deactivate user:', error);
        return safeError(res, 500, 'Failed to deactivate user');
    }
});

/**
 * GET /api/users/role/:role — list users by role (used by officer routing).
 */
router.get('/role/:role', async (req: Request, res: Response) => {
    try {
        const role = req.params.role;
        if (!role) {
            return res.status(400).json({ success: false, error: 'role is required' });
        }

        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const { rows } = await query<UserRow>(
            // Pickers (e.g. assigning a farmer to an officer) never offer demo accounts:
            // a real farmer assigned to the demo officer would be visible to the public demo session.
            `SELECT * FROM users WHERE role = $1 AND is_active = true AND ${demoSql('users')} ORDER BY first_name`,
            [role]
        );

        return res.json({ success: true, data: mapUserRows(rows) });
    } catch (error) {
        logger.error('Failed to list users by role:', error);
        return safeError(res, 500, 'Failed to list users by role');
    }
});

export default router;
