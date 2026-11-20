import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import { query, getPool, withTransaction, type TypedQueryResult } from '@/services/databaseService';
import type { CountRow, UserRow, UserPublicRow } from '@/types/rowTypes';
import { mapUserPublicRows, mapUserPublicRow, mapUserRows } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { countActiveSystemAdmins, isSystemAdminUser } from '@/services/systemAdminService';
import {
    acquireUserSessionLock,
    revokeAllUserSessions,
    revokeAllUserSessionsInTransaction,
    publishSessionRevocations,
} from '@/services/sessionService';
import { demoSql } from '@/services/demoScope';
import { validateRecordScope } from '@/services/demoRecordScope';
import { computeSubscriptionPeriodEnd } from '@/services/subscriptionUtils';
import {
    buildUserColumns,
    buildSubscriptionJoin,
    buildUserSubscriptionSelect,
    SUBSCRIPTION_SELECT_COLUMNS,
} from '@/services/userQueryBuilder';
import { defaultCountryName } from '@/services/country/phone';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INACTIVE_STRIPE_SUBSCRIPTION_STATUSES = new Set(['canceled', 'expired', 'incomplete_expired']);
const STRIPE_MANAGED_PLAN_CONFLICT_MESSAGE =
    'Cannot reassign plan while the user has an active Stripe-managed subscription. Cancel or update the subscription in Stripe first.';

class PlanAssignmentConflictError extends Error {
    constructor(message: string = STRIPE_MANAGED_PLAN_CONFLICT_MESSAGE) {
        super(message);
        this.name = 'PlanAssignmentConflictError';
    }
}

interface PlanLookupRow {
    id: string;
    name: string;
    price: string | number;
    interval: string | null;
}

interface ExistingSubscriptionRow {
    id: string;
    plan_id: string;
    status?: string | null;
    stripe_subscription_id?: string | null;
    price?: string | number;
}

function hasActiveStripeSubscription(existing: ExistingSubscriptionRow | undefined): boolean {
    const stripeSubscriptionId =
        typeof existing?.stripe_subscription_id === 'string'
            ? existing.stripe_subscription_id.trim()
            : '';
    if (!stripeSubscriptionId) return false;
    const status = typeof existing?.status === 'string' ? existing.status.trim().toLowerCase() : '';
    return !INACTIVE_STRIPE_SUBSCRIPTION_STATUSES.has(status);
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

async function txQuery<T = Record<string, unknown>>(
    client: PoolClient,
    text: string,
    params?: unknown[]
): Promise<TypedQueryResult<T>> {
    const res = await client.query(text, params);
    return res as unknown as TypedQueryResult<T>;
}

async function runWithColumnFallback<T>(
    client: PoolClient,
    primary: () => Promise<TypedQueryResult<T>>,
    fallback: () => Promise<TypedQueryResult<T>>
): Promise<T[]> {
    const savepoint = 'sp_users_col_fallback';
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
        const res = await primary();
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return res.rows || [];
    } catch (dbErr: unknown) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        if (!isMissingColumnError(dbErr)) throw dbErr;
        logger.warn('users table lacks country or last_login_at column; using fallback query');
        const fallbackRes = await fallback();
        return fallbackRes.rows || [];
    }
}

async function upsertUserSubscription(
    client: PoolClient,
    userId: string,
    planId: string,
    now: Date,
    periodEnd: Date
): Promise<string | undefined> {
    const upserted = await txQuery<{ id: string }>(
        client,
        `INSERT INTO subscriptions (
             user_id, plan_id, status, current_period_start, current_period_end,
             cancel_at_period_end, stripe_subscription_id, expiry_notification_sent, updated_at
         )
         VALUES ($1, $2, 'active', $3, $4, false, NULL, false, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET plan_id = EXCLUDED.plan_id,
               status = 'active',
               current_period_start = EXCLUDED.current_period_start,
               current_period_end = EXCLUDED.current_period_end,
               cancel_at_period_end = false,
               stripe_subscription_id = NULL,
               expiry_notification_sent = false,
               updated_at = NOW()
           WHERE subscriptions.stripe_subscription_id IS NULL
              OR btrim(subscriptions.stripe_subscription_id) = ''
              OR lower(btrim(COALESCE(subscriptions.status, ''))) IN ('canceled', 'expired', 'incomplete_expired')
         RETURNING id`,
        [userId, planId, now, periodEnd]
    );
    return upserted.rows[0]?.id;
}

async function resetSubscriptionUsage(client: PoolClient, subscriptionId: string): Promise<void> {
    await txQuery(
        client,
        `INSERT INTO usage (
             subscription_id, sms_count, ai_chat_count, report_count,
             ai_vision_count, speech_count, whatsapp_count, last_reset_at, updated_at
         )
         VALUES ($1, 0, 0, 0, 0, 0, 0, NOW(), NOW())
         ON CONFLICT (subscription_id) DO UPDATE
           SET sms_count = 0,
               ai_chat_count = 0,
               report_count = 0,
               ai_vision_count = 0,
               speech_count = 0,
               whatsapp_count = 0,
               last_reset_at = NOW(),
               updated_at = NOW()`,
        [subscriptionId]
    );
}

async function recordPlanChangeEvent(
    client: PoolClient,
    subscriptionId: string,
    existing: { plan_id: string; price?: string | number } | undefined,
    plan: PlanLookupRow
): Promise<void> {
    if (!existing || existing.plan_id === plan.id) return;
    await txQuery(
        client,
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

async function assignUserPlan(
    client: PoolClient,
    userId: string,
    plan: PlanLookupRow
): Promise<{ periodEnd: Date }> {
    // Serialize per-user plan mutations so concurrent requests cannot read the
    // same previous plan and log a stale from_plan_id / from_price change event.
    await txQuery(
        client,
        `SELECT pg_advisory_xact_lock(hashtext('user_plan'), hashtext($1))`,
        [userId]
    );
    const now = new Date();
    const periodEnd = computeSubscriptionPeriodEnd(plan.interval, now);
    const existingRes = await txQuery<ExistingSubscriptionRow>(
        client,
        `SELECT s.id, s.plan_id, s.status, s.stripe_subscription_id, sp.price
         FROM subscriptions s
         LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
         WHERE s.user_id = $1
         FOR UPDATE OF s`,
        [userId]
    );
    const existing = existingRes.rows[0];
    if (hasActiveStripeSubscription(existing)) {
        throw new PlanAssignmentConflictError();
    }
    const subscriptionId = await upsertUserSubscription(client, userId, plan.id, now, periodEnd);
    if (!subscriptionId) {
        throw new PlanAssignmentConflictError();
    }
    await resetSubscriptionUsage(client, subscriptionId);
    await recordPlanChangeEvent(client, subscriptionId, existing, plan);
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
    client: PoolClient,
    userRow: UserPublicRow | undefined,
    targetPlan: PlanLookupRow | null
) {
    if (!userRow) return null;
    const rowWithPlan = targetPlan
        ? mergePlanIntoRow(userRow, targetPlan, (await assignUserPlan(client, userRow.id, targetPlan)).periodEnd)
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
    const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : defaultCountryName();
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;

    const safeRole = role.toLowerCase();
    const normalizedRole = ALLOWED_ROLES.includes(safeRole) ? safeRole : 'extension_officer';

    return { email, password, firstName, lastName, normalizedRole, region, country, phone };
}

function isMissingColumnError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { message?: string; code?: string };
    return Boolean(
        e.message?.includes('country') ||
        e.message?.includes('last_login_at') ||
        e.message?.includes('is_system_admin') ||
        e.message?.includes('manager_id') ||
        e.code === '42703'
    );
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
    manager_id: 'manager_id',
    managerId: 'manager_id',
};

const ALLOWED_ROLES = ['farmer', 'extension_officer', 'regional_manager', 'admin'];

const SYSTEM_ADMIN_REQUIRED_CODE = 'SYSTEM_ADMIN_REQUIRED';
const LAST_SYSTEM_ADMIN_CODE = 'LAST_SYSTEM_ADMIN';

interface UserGuardRow {
    id: string;
    role: string | null;
    is_active: boolean | null;
    is_system_admin: boolean | null;
}

interface GuardFailure {
    status: number;
    error: string;
    code: string;
}

async function loadUserGuardRow(id: string): Promise<UserGuardRow | null> {
    const { rows } = await query<UserGuardRow>(
        'SELECT id, role, is_active, is_system_admin FROM users WHERE id = $1',
        [id]
    );
    return rows[0] ?? null;
}

async function actorIsSystemAdmin(req: Request): Promise<boolean> {
    const userId = req.user?.userId;
    return userId ? isSystemAdminUser(userId) : false;
}

interface ManagerScope {
    region: string;
}

/**
 * A regional manager's directory is their own region. The region is read from
 * their own account, never from a query parameter, so it cannot be widened by
 * the caller. `null` means the caller is not a regional manager; a manager with
 * no region recorded gets an empty region, which matches no rows.
 */
async function regionalManagerScope(req: Request): Promise<ManagerScope | null> {
    if (req.user?.role !== 'regional_manager' || !req.user.userId) return null;
    const { rows } = await query<{ region: string | null }>(
        'SELECT region FROM users WHERE id = $1',
        [req.user.userId]
    );
    return { region: rows[0]?.region ?? '' };
}

/**
 * Upgrading or downgrading an account by hand (no payment) is reserved for the
 * system administrator. Returns the refusal to send, or null when allowed.
 */
async function manualPlanChangeRefusal(req: Request, body: Record<string, unknown>): Promise<GuardFailure | null> {
    if (!extractOptionalPlanId(body).provided) return null;
    if (await actorIsSystemAdmin(req)) return null;
    return {
        status: 403,
        error: 'Only a system administrator can change a subscription plan manually',
        code: SYSTEM_ADMIN_REQUIRED_CODE,
    };
}

/**
 * Only a system administrator may create an administrator, promote someone to
 * administrator, or change a system-administrator account. The last active
 * system administrator can never be demoted or deactivated, whatever the
 * actor's flag says.
 */
async function validateSystemAdminChange(
    target: UserGuardRow,
    safeUpdates: Record<string, unknown>,
    actorHasFlag: boolean
): Promise<GuardFailure | null> {
    const requestedRole = typeof safeUpdates.role === 'string' ? safeUpdates.role.toLowerCase() : null;
    const requestedIsActive = typeof safeUpdates.is_active === 'boolean' ? safeUpdates.is_active : null;

    if (!actorHasFlag) {
        if (target.is_system_admin === true) {
            return {
                status: 403,
                error: 'Only a system administrator can modify a system administrator account',
                code: SYSTEM_ADMIN_REQUIRED_CODE,
            };
        }
        if (requestedRole === 'admin') {
            return {
                status: 403,
                error: 'Only a system administrator can promote a user to administrator',
                code: SYSTEM_ADMIN_REQUIRED_CODE,
            };
        }
        return null;
    }

    if (target.is_system_admin !== true) return null;
    const demoting = requestedRole !== null && requestedRole !== 'admin';
    const deactivating = requestedIsActive === false;
    if (!demoting && !deactivating) return null;
    // An already-inactive account cannot take the last seat away.
    if (target.is_active === false) return null;
    if ((await countActiveSystemAdmins()) <= 1) {
        return {
            status: 400,
            error: 'The last active system administrator cannot be demoted or deactivated',
            code: LAST_SYSTEM_ADMIN_CODE,
        };
    }
    return null;
}

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
    client: PoolClient,
    id: string,
    safeUpdates: Record<string, unknown>
): Promise<UserPublicRow[]> {
    const allKeys = Object.keys(safeUpdates);
    const buildUpdateCte = (keys: string[], legacySchema: boolean) => `
        WITH updated AS (
            UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
            WHERE id = $${keys.length + 1}
            RETURNING ${buildUserColumns({ legacySchema })}
        )
        SELECT updated.*, ${SUBSCRIPTION_SELECT_COLUMNS}
        FROM updated
        ${buildSubscriptionJoin('updated')}`;

    const fallbackKeys = allKeys.filter(k => k !== 'country');
    return runWithColumnFallback(
        client,
        () =>
            txQuery<UserPublicRow>(
                client,
                buildUpdateCte(allKeys, false),
                Object.values(safeUpdates).concat(id)
            ),
        () =>
            txQuery<UserPublicRow>(
                client,
                buildUpdateCte(fallbackKeys, true),
                fallbackKeys.map(k => safeUpdates[k]).concat(id)
            )
    );
}

interface ManagerLookupRow {
    id: string;
    role: string | null;
    is_active: boolean | null;
}

/**
 * A manager link must point at an active regional manager, and only an
 * extension officer can carry one. `null` clears the link.
 */
async function validateManagerLink(
    managerId: unknown,
    targetRole: string | null
): Promise<string | null> {
    if (managerId === undefined || managerId === null || managerId === '') return null;
    if (typeof managerId !== 'string' || !UUID_RE.test(managerId)) {
        return 'managerId must be a user id or null';
    }
    if (targetRole !== 'extension_officer') {
        return 'Only extension officers report to a regional manager';
    }
    const { rows } = await query<ManagerLookupRow>(
        'SELECT id, role, is_active FROM users WHERE id = $1',
        [managerId]
    );
    const manager = rows[0];
    if (!manager || manager.role !== 'regional_manager' || manager.is_active === false) {
        return 'managerId must reference an active regional manager';
    }
    return null;
}

async function fetchUserRowForPlanUpdate(client: PoolClient, id: string): Promise<UserPublicRow[]> {
    const buildSelectCte = (legacySchema: boolean) => `
        WITH target AS (
            SELECT ${buildUserColumns({ legacySchema })}
            FROM users WHERE id = $1
        )
        SELECT target.*, ${SUBSCRIPTION_SELECT_COLUMNS}
        FROM target
        ${buildSubscriptionJoin('target')}`;

    return runWithColumnFallback(
        client,
        () => txQuery<UserPublicRow>(client, buildSelectCte(false), [id]),
        () => txQuery<UserPublicRow>(client, buildSelectCte(true), [id])
    );
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
        const dataset = req.query.dataset === 'demo';
        // A regional manager lists only staff in their own region. Region is a
        // column on every schema version, so the legacy fallback query can keep
        // the same predicate.
        const managerScope = await regionalManagerScope(req);
        const scopeClause = managerScope ? ' AND users.region = $2' : '';
        const listParams = managerScope ? [dataset, managerScope.region] : [dataset];
        const listQuery = (legacySchema: boolean) =>
            buildUserSubscriptionSelect({
                source: 'users',
                legacySchema,
                where: `COALESCE(is_demo, false) = $1${scopeClause}`,
                orderBy: 'users.created_at DESC',
            });

        try {
            const queryRes = await query<UserPublicRow>(listQuery(false), listParams);
            rows = queryRes.rows || [];
        } catch (dbErr: unknown) {
            if (isMissingColumnError(dbErr)) {
                logger.warn('users table lacks country or last_login_at column; selecting fallback');
                const fallbackRes = await query<UserPublicRow>(listQuery(true), listParams);
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
        const detailWhere = `users.id = $1 ${demoAccountsFilter.replace('WHERE', 'AND')}`;
        const detailQuery = (legacySchema: boolean) =>
            buildUserSubscriptionSelect({ source: 'users', legacySchema, where: detailWhere });

        try {
            const queryRes = await query<UserPublicRow>(detailQuery(false), [id]);
            rows = queryRes.rows || [];
        } catch (dbErr: unknown) {
            if (isMissingColumnError(dbErr)) {
                logger.warn('users table lacks country or last_login_at column; selecting fallback');
                const fallbackRes = await query<UserPublicRow>(detailQuery(true), [id]);
                rows = fallbackRes.rows || [];
            } else {
                throw dbErr;
            }
        }

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const managerScope = await regionalManagerScope(req);
        if (managerScope && rows[0].region !== managerScope.region) {
            // Out-of-region staff are reported as absent rather than forbidden: a
            // manager has no business learning that the account exists.
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
    client: PoolClient,
    data: ReturnType<typeof extractCreateUserData>,
    passwordHash: string
): Promise<UserPublicRow[]> {
    return runWithColumnFallback(
        client,
        () =>
            txQuery<UserPublicRow>(
                client,
                `INSERT INTO users (email, password_hash, first_name, last_name, role, region, country, phone, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                 ON CONFLICT (email) DO NOTHING
                 RETURNING ${buildUserColumns({ includeDemoFlag: false })}`,
                [data.email, passwordHash, data.firstName, data.lastName, data.normalizedRole, data.region, data.country, data.phone]
            ),
        () =>
            txQuery<UserPublicRow>(
                client,
                `INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                 ON CONFLICT (email) DO NOTHING
                 RETURNING ${buildUserColumns({ includeDemoFlag: false, legacySchema: true })}`,
                [data.email, passwordHash, data.firstName, data.lastName, data.normalizedRole, data.region, data.phone]
            )
    );
}

async function createUserInTransaction(
    data: ReturnType<typeof extractCreateUserData>,
    passwordHash: string,
    targetPlan: PlanLookupRow | null
) {
    return withTransaction(async client => {
        const rows = await insertUserWithFallback(client, data, passwordHash);
        if (rows.length === 0) return null;
        return finalizeUserWithPlan(client, rows[0], targetPlan);
    });
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
    client: PoolClient,
    id: string,
    safeUpdates: Record<string, unknown>
): Promise<UserPublicRow[]> {
    if (Object.keys(safeUpdates).length === 0) {
        return fetchUserRowForPlanUpdate(client, id);
    }
    safeUpdates.updated_at = new Date();
    return executeUserUpdate(client, id, safeUpdates);
}

interface UserUpdateTransactionResult {
    dto: ReturnType<typeof mapUserPublicRow>;
    revokedTokenHashes: string[];
}

async function updateUserInTransaction(
    id: string,
    safeUpdates: Record<string, unknown>,
    targetPlan: PlanLookupRow | null,
    shouldRevokeSessions: boolean
): Promise<UserUpdateTransactionResult | null> {
    return withTransaction(async client => {
        // Acquire the per-user session advisory lock before touching `users`
        // (matching login/mfa/refresh/password lock order) so a concurrent
        // `/auth/refresh` cannot read the uncommitted pre-revocation session
        // and mint a surviving former-role token.
        if (shouldRevokeSessions) {
            await acquireUserSessionLock(client, id);
        }
        const rows = await applyUserUpdateOrFetch(client, id, safeUpdates);
        if (rows.length === 0) return null;
        const dto = await finalizeUserWithPlan(client, rows[0], targetPlan);
        if (!dto) return null;

        // Roles are embedded in the JWT, so revoke existing sessions inside the
        // same transaction whenever role or activation changes. A session UPDATE
        // failure rolls back the role/activation change instead of leaving old
        // tokens valid under a former role.
        const revokedTokenHashes = shouldRevokeSessions
            ? (await revokeAllUserSessionsInTransaction(client, id)).tokenHashes
            : [];

        return { dto, revokedTokenHashes };
    });
}

function handleUserMutationError(
    res: Response,
    error: unknown,
    logContext: string,
    fallbackMessage: string
) {
    if (error instanceof PlanAssignmentConflictError) {
        return res.status(409).json({ success: false, error: error.message });
    }
    logger.error(logContext, error);
    return safeError(res, 500, fallbackMessage);
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

        // `authorize(['admin'])` only proves the caller is an admin. Minting
        // another admin is reserved for the system administrator.
        if (data.normalizedRole === 'admin' && !(await actorIsSystemAdmin(req))) {
            return res.status(403).json({
                success: false,
                error: 'Only a system administrator can create administrator accounts',
                errorCode: SYSTEM_ADMIN_REQUIRED_CODE,
            });
        }

        const planRefusal = await manualPlanChangeRefusal(req, body);
        if (planRefusal) {
            return res.status(planRefusal.status).json({ success: false, error: planRefusal.error, errorCode: planRefusal.code });
        }

        const planResolution = await resolveRequestedPlan(body);
        if (planResolution.error) {
            return res.status(400).json({ success: false, error: planResolution.error });
        }

        const passwordHash = await bcrypt.hash(data.password, 10);
        const dto = await createUserInTransaction(data, passwordHash, planResolution.plan);
        if (!dto) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

        return res.status(201).json({ success: true, data: dto });
    } catch (error) {
        return handleUserMutationError(res, error, 'Failed to create user:', 'Failed to create user');
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
        const planRefusal = await manualPlanChangeRefusal(req, updates);
        if (planRefusal) {
            return res.status(planRefusal.status).json({ success: false, error: planRefusal.error, errorCode: planRefusal.code });
        }
        const safeUpdates = extractSafeUserUpdates(updates);
        const planResolution = await resolveRequestedPlan(updates);

        const payloadError = validatePutPayload(safeUpdates, planResolution, id, req.user?.userId);
        if (payloadError) {
            return res.status(400).json({ success: false, error: payloadError });
        }

        const target = await loadUserGuardRow(id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const managerLinkError = await validateManagerLink(
            safeUpdates.manager_id,
            typeof safeUpdates.role === 'string' ? safeUpdates.role : target.role
        );
        if (managerLinkError) {
            return res.status(400).json({ success: false, error: managerLinkError });
        }
        const guardFailure = await validateSystemAdminChange(
            target,
            safeUpdates,
            await actorIsSystemAdmin(req)
        );
        if (guardFailure) {
            return res
                .status(guardFailure.status)
                .json({ success: false, error: guardFailure.error, errorCode: guardFailure.code });
        }

        const shouldRevokeSessions = safeUpdates.is_active !== undefined || safeUpdates.role !== undefined;
        const result = await updateUserInTransaction(
            id,
            safeUpdates,
            planResolution.plan,
            shouldRevokeSessions
        );
        if (!result) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Publish to local/Redis revocation caches strictly post-commit so a
        // rolled-back transaction never poisons active sessions.
        if (result.revokedTokenHashes.length > 0) {
            publishSessionRevocations(result.revokedTokenHashes);
        }

        return res.json({ success: true, data: result.dto });
    } catch (error) {
        return handleUserMutationError(res, error, 'Failed to update user:', 'Failed to update user');
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

        const target = await loadUserGuardRow(id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (target.is_system_admin === true) {
            if (!(await actorIsSystemAdmin(req))) {
                return res.status(403).json({
                    success: false,
                    error: 'Only a system administrator can deactivate a system administrator account',
                    errorCode: SYSTEM_ADMIN_REQUIRED_CODE,
                });
            }
            if (target.is_active !== false && (await countActiveSystemAdmins()) <= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'The last active system administrator cannot be deactivated',
                    errorCode: LAST_SYSTEM_ADMIN_CODE,
                });
            }
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

        // Officer pickers for a regional manager must not offer staff from
        // another region.
        const managerScope = await regionalManagerScope(req);
        const { rows } = await query<UserRow>(
            // Pickers (e.g. assigning a farmer to an officer) never offer demo accounts:
            // a real farmer assigned to the demo officer would be visible to the public demo session.
            `SELECT * FROM users WHERE role = $1 AND is_active = true AND ${demoSql('users')}
             ${managerScope ? 'AND region = $2' : ''} ORDER BY first_name`,
            managerScope ? [role, managerScope.region] : [role]
        );

        return res.json({ success: true, data: mapUserRows(rows) });
    } catch (error) {
        logger.error('Failed to list users by role:', error);
        return safeError(res, 500, 'Failed to list users by role');
    }
});

export default router;
