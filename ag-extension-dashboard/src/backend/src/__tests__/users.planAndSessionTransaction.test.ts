import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { authorize, UserRole } from '../middleware/authorize';
import { hashToken } from '../services/sessionService';
import * as sharedState from '../services/sharedState';
import { getPool } from '../services/db/pool';
import usersRouter from '../routes/users';

jest.mock('../services/db/pool', () => ({
    getPool: jest.fn(),
}));
jest.mock('../services/cacheService', () => ({ getCache: jest.fn(() => null) }));
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetPool = getPool as jest.Mock;

const PLAN_FREE_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_PRO_ID = '22222222-2222-4222-8222-222222222222';
const PLAN_ENTERPRISE_ID = '33333333-3333-4333-8333-333333333333';
const TARGET_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

interface StoredUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    region: string | null;
    country: string;
    phone: string | null;
    isActive: boolean;
}

interface StoredPlan {
    id: string;
    name: string;
    price: number;
    interval: string;
    isActive: boolean;
}

interface StoredSubscription {
    id: string;
    userId: string;
    planId: string;
    status: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: Date;
}

interface StoredSession {
    userId: string;
    isRevoked: boolean;
    expiresAt: Date;
}

interface ChangeEventRecord {
    subscriptionId: string;
    fromPlanId: string;
    toPlanId: string;
    fromPrice: number;
    toPrice: number;
}

interface DbState {
    users: Map<string, StoredUser>;
    plans: Map<string, StoredPlan>;
    subscriptions: Map<string, StoredSubscription>;
    sessions: Map<string, StoredSession>;
    usageResetCount: number;
    changeEvents: ChangeEventRecord[];
}

interface RecordedQuery {
    clientId: string;
    sql: string;
    params: unknown[];
}

type SqlHandler = (sql: string, params: unknown[], state: DbState) => { rows: unknown[]; rowCount: number };

const dbOptions = {
    failSessionUpdate: false,
    failCommit: false,
    simulateStripeRaceOnUpsert: false,
};

let committedState: DbState;
let queryLog: RecordedQuery[] = [];
let clientCounter = 0;

function cloneState(source: DbState): DbState {
    return {
        users: new Map(Array.from(source.users.entries(), ([k, v]) => [k, { ...v }])),
        plans: new Map(Array.from(source.plans.entries(), ([k, v]) => [k, { ...v }])),
        subscriptions: new Map(
            Array.from(source.subscriptions.entries(), ([k, v]) => [
                k,
                { ...v, currentPeriodEnd: new Date(v.currentPeriodEnd.getTime()) },
            ])
        ),
        sessions: new Map(
            Array.from(source.sessions.entries(), ([k, v]) => [
                k,
                { ...v, expiresAt: new Date(v.expiresAt.getTime()) },
            ])
        ),
        usageResetCount: source.usageResetCount,
        changeEvents: source.changeEvents.map(event => ({ ...event })),
    };
}

function isInactiveStripeStatus(status: string | null): boolean {
    const normalized = (status ?? '').trim().toLowerCase();
    return normalized === 'canceled' || normalized === 'expired' || normalized === 'incomplete_expired';
}

function canOverwriteSubscription(existing: StoredSubscription | undefined): boolean {
    if (!existing) return true;
    const stripeId = (existing.stripeSubscriptionId ?? '').trim();
    return stripeId.length === 0 || isInactiveStripeStatus(existing.status);
}

function buildPublicUserRow(user: StoredUser, state: DbState) {
    const sub = state.subscriptions.get(user.id);
    const plan = sub ? state.plans.get(sub.planId) : undefined;
    return {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        region: user.region,
        country: user.country,
        phone: user.phone,
        is_active: user.isActive,
        preferred_language: null,
        avatar_url: null,
        last_login: null,
        is_demo: false,
        plan_id: sub?.planId ?? null,
        plan_name: plan?.name ?? null,
        plan_price: plan?.price ?? null,
        subscription_status: sub?.status ?? null,
        subscription_period_end: sub?.currentPeriodEnd ?? null,
    };
}

function applyColumnAssignment(user: StoredUser, column: string, value: unknown): void {
    if (column === 'role' && typeof value === 'string') user.role = value as UserRole;
    if (column === 'is_active' && typeof value === 'boolean') user.isActive = value;
    if (column === 'first_name' && typeof value === 'string') user.firstName = value;
    if (column === 'last_name' && typeof value === 'string') user.lastName = value;
}

function handleUserUpdateSql(sql: string, params: unknown[], state: DbState) {
    const match = /UPDATE users SET ([\s\S]+?) WHERE id = \$(\d+)/.exec(sql);
    if (!match) return { rows: [], rowCount: 0 };
    const idIndex = Number(match[2]) - 1;
    const user = state.users.get(String(params[idIndex]));
    if (!user) return { rows: [], rowCount: 0 };

    for (const part of match[1].split(',')) {
        const assign = /^\s*([a-z_]+)\s*=\s*\$(\d+)\s*$/.exec(part);
        if (assign) {
            applyColumnAssignment(user, assign[1], params[Number(assign[2]) - 1]);
        }
    }
    return { rows: [buildPublicUserRow(user, state)], rowCount: 1 };
}

function handlePlanSelect(params: unknown[], state: DbState) {
    const plan = state.plans.get(String(params[0]));
    if (!plan?.isActive) return { rows: [], rowCount: 0 };
    return { rows: [plan], rowCount: 1 };
}

function handleSoftDeleteUser(params: unknown[], state: DbState) {
    const user = state.users.get(String(params[0]));
    if (!user) return { rows: [], rowCount: 0 };
    user.isActive = false;
    return { rows: [{ id: user.id }], rowCount: 1 };
}

function handleTargetUserSelect(params: unknown[], state: DbState) {
    const user = state.users.get(String(params[0]));
    if (!user) return { rows: [], rowCount: 0 };
    return { rows: [buildPublicUserRow(user, state)], rowCount: 1 };
}

function handleSubscriptionSelect(params: unknown[], state: DbState) {
    const sub = state.subscriptions.get(String(params[0]));
    if (!sub) return { rows: [], rowCount: 0 };
    const plan = state.plans.get(sub.planId);
    return {
        rows: [
            {
                id: sub.id,
                plan_id: sub.planId,
                status: sub.status,
                stripe_subscription_id: sub.stripeSubscriptionId,
                price: plan?.price ?? 0,
            },
        ],
        rowCount: 1,
    };
}

function handleSubscriptionUpsertSql(params: unknown[], state: DbState, simulateRace: boolean) {
    if (simulateRace) return { rows: [], rowCount: 0 };
    const [userId, planId, , periodEnd] = params as [string, string, Date, Date];
    const existing = state.subscriptions.get(userId);
    if (!canOverwriteSubscription(existing)) {
        return { rows: [], rowCount: 0 };
    }
    const id = existing?.id ?? `sub-${userId}`;
    state.subscriptions.set(userId, {
        id,
        userId,
        planId,
        status: 'active',
        stripeSubscriptionId: null,
        currentPeriodEnd: new Date(periodEnd),
    });
    return { rows: [{ id }], rowCount: 1 };
}

function handleChangeEventInsert(params: unknown[], state: DbState) {
    const [subscriptionId, fromPlanId, toPlanId, fromPrice, toPrice] = params as [
        string,
        string,
        string,
        number,
        number,
    ];
    state.changeEvents.push({ subscriptionId, fromPlanId, toPlanId, fromPrice, toPrice });
    return { rows: [], rowCount: 1 };
}

function handleRevokeSessionsSql(userId: string, state: DbState, shouldFail: boolean) {
    if (shouldFail) throw new Error('Session update failed');
    const rows: Array<{ token_hash: string }> = [];
    for (const [tokenHash, session] of state.sessions) {
        if (session.userId === userId && !session.isRevoked) {
            session.isRevoked = true;
            rows.push({ token_hash: tokenHash });
        }
    }
    return { rows, rowCount: rows.length };
}

function handleSessionLookupSql(tokenHash: string, state: DbState) {
    const session = state.sessions.get(tokenHash);
    if (!session) return { rows: [], rowCount: 0 };
    const user = state.users.get(session.userId);
    return {
        rows: [
            {
                is_revoked: session.isRevoked,
                expires_at: session.expiresAt,
                is_active: user?.isActive ?? false,
            },
        ],
        rowCount: 1,
    };
}

function isControlNoop(sql: string): boolean {
    return (
        sql.startsWith('SAVEPOINT') ||
        sql.startsWith('RELEASE SAVEPOINT') ||
        sql.startsWith('ROLLBACK TO SAVEPOINT') ||
        sql.includes('pg_advisory_xact_lock')
    );
}

const SQL_ROUTES: Array<[string, SqlHandler]> = [
    ['FROM subscription_plans', (_sql, params, state) => handlePlanSelect(params, state)],
    ['FROM user_sessions', (_sql, params, state) => handleSessionLookupSql(String(params[0]), state)],
    ['UPDATE user_sessions', (_sql, params, state) => handleRevokeSessionsSql(String(params[0]), state, dbOptions.failSessionUpdate)],
    ['UPDATE users SET is_active = false', (_sql, params, state) => handleSoftDeleteUser(params, state)],
    ['WITH updated AS', (sql, params, state) => handleUserUpdateSql(sql, params, state)],
    ['WITH target AS', (_sql, params, state) => handleTargetUserSelect(params, state)],
    ['FROM subscriptions s', (_sql, params, state) => handleSubscriptionSelect(params, state)],
    ['INSERT INTO subscriptions', (_sql, params, state) => handleSubscriptionUpsertSql(params, state, dbOptions.simulateStripeRaceOnUpsert)],
    ['INSERT INTO usage', (_sql, _params, state) => {
        state.usageResetCount += 1;
        return { rows: [], rowCount: 1 };
    }],
    ['INSERT INTO subscription_change_events', (_sql, params, state) => handleChangeEventInsert(params, state)],
];

function executeStatement(sql: string, params: unknown[], state: DbState) {
    if (isControlNoop(sql)) return { rows: [], rowCount: 0 };
    const matched = SQL_ROUTES.find(([needle]) => sql.includes(needle));
    return matched ? matched[1](sql, params, state) : { rows: [], rowCount: 0 };
}

function commitTransaction(txState: DbState | null): null {
    if (dbOptions.failCommit) {
        throw new Error('Serialization failure on COMMIT');
    }
    if (txState) {
        committedState = txState;
    }
    return null;
}

function createFakeTxClient() {
    const clientId = `tx-client-${++clientCounter}`;
    let txState: DbState | null = null;
    return {
        query: jest.fn(async (sql: string, params: unknown[] = []) => {
            queryLog.push({ clientId, sql, params });
            if (sql === 'BEGIN') {
                txState = cloneState(committedState);
                return { rows: [], rowCount: 0 };
            }
            if (sql === 'COMMIT') {
                txState = commitTransaction(txState);
                return { rows: [], rowCount: 0 };
            }
            if (sql === 'ROLLBACK') {
                txState = null;
                return { rows: [], rowCount: 0 };
            }
            return executeStatement(sql, params, txState ?? committedState);
        }),
        release: jest.fn(),
    };
}

const fakePool = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
        queryLog.push({ clientId: 'pool', sql, params });
        return executeStatement(sql, params, committedState);
    }),
    connect: jest.fn(async () => createFakeTxClient()),
};

const app = express();
app.use(express.json());
app.use('/users', usersRouter);
app.get(
    '/protected',
    authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']),
    (req, res) => res.json(req.user)
);

function issueToken(userId: string, role: UserRole): string {
    const value = jwt.sign(
        { userId, email: `${userId}@example.test`, role, jti: randomUUID() },
        config.jwt.secret,
        { expiresIn: '1h' }
    );
    committedState.sessions.set(hashToken(value), {
        userId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 3_600_000),
    });
    return value;
}

function resetFixture(): void {
    sharedState.__resetSharedStateForTests();
    mockGetPool.mockReturnValue(fakePool);
    dbOptions.failSessionUpdate = false;
    dbOptions.failCommit = false;
    dbOptions.simulateStripeRaceOnUpsert = false;
    queryLog = [];
    clientCounter = 0;

    committedState = {
        users: new Map<string, StoredUser>([
            [
                ADMIN_USER_ID,
                {
                    id: ADMIN_USER_ID,
                    email: 'admin@example.test',
                    firstName: 'Admin',
                    lastName: 'User',
                    role: 'admin',
                    region: null,
                    country: 'Kenya',
                    phone: null,
                    isActive: true,
                },
            ],
            [
                TARGET_USER_ID,
                {
                    id: TARGET_USER_ID,
                    email: 'officer@example.test',
                    firstName: 'Grace',
                    lastName: 'Moyo',
                    role: 'extension_officer',
                    region: 'Central',
                    country: 'Kenya',
                    phone: null,
                    isActive: true,
                },
            ],
        ]),
        plans: new Map<string, StoredPlan>([
            [PLAN_FREE_ID, { id: PLAN_FREE_ID, name: 'Free', price: 0, interval: 'month', isActive: true }],
            [PLAN_PRO_ID, { id: PLAN_PRO_ID, name: 'Pro', price: 29, interval: 'month', isActive: true }],
            [
                PLAN_ENTERPRISE_ID,
                { id: PLAN_ENTERPRISE_ID, name: 'Enterprise', price: 99, interval: 'year', isActive: true },
            ],
        ]),
        subscriptions: new Map<string, StoredSubscription>(),
        sessions: new Map<string, StoredSession>(),
        usageResetCount: 0,
        changeEvents: [],
    };
}

beforeEach(() => {
    resetFixture();
});

describe('Finding 1 — admin plan reassignment guards active Stripe subscriptions', () => {
    it.each(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete', null] as const)(
        'rejects plan reassignment with 409 when user has a Stripe subscription with status=%s',
        async status => {
            committedState.subscriptions.set(TARGET_USER_ID, {
                id: 'sub-existing',
                userId: TARGET_USER_ID,
                planId: PLAN_PRO_ID,
                status,
                stripeSubscriptionId: 'sub_stripe_live_123',
                currentPeriodEnd: new Date(Date.now() + 86_400_000),
            });

            const adminToken = issueToken(ADMIN_USER_ID, 'admin');
            const res = await request(app)
                .put(`/users/${TARGET_USER_ID}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ planId: PLAN_ENTERPRISE_ID });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/stripe/i);

            const sub = committedState.subscriptions.get(TARGET_USER_ID);
            expect(sub?.stripeSubscriptionId).toBe('sub_stripe_live_123');
            expect(sub?.planId).toBe(PLAN_PRO_ID);
            expect(sub?.status).toBe(status);
            expect(committedState.usageResetCount).toBe(0);
            expect(committedState.changeEvents).toHaveLength(0);
            expect(queryLog.some(entry => entry.sql.includes('INSERT INTO subscriptions'))).toBe(false);
            expect(queryLog.some(entry => entry.sql === 'ROLLBACK')).toBe(true);
            expect(queryLog.some(entry => entry.sql === 'COMMIT')).toBe(false);
        }
    );

    it('rejects same-plan reassignment and whitespace-padded active Stripe subscription IDs with 409', async () => {
        committedState.subscriptions.set(TARGET_USER_ID, {
            id: 'sub-existing',
            userId: TARGET_USER_ID,
            planId: PLAN_PRO_ID,
            status: 'active',
            stripeSubscriptionId: ' sub_stripe_padded_456 ',
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
        });

        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ planId: PLAN_PRO_ID });

        expect(res.status).toBe(409);
        expect(committedState.subscriptions.get(TARGET_USER_ID)?.stripeSubscriptionId).toBe(' sub_stripe_padded_456 ');
        expect(committedState.usageResetCount).toBe(0);
        expect(queryLog.some(entry => entry.sql === 'ROLLBACK')).toBe(true);
    });

    it('allows non-plan updates (role, firstName) on users with an active Stripe subscription without disturbing Stripe state', async () => {
        committedState.subscriptions.set(TARGET_USER_ID, {
            id: 'sub-existing',
            userId: TARGET_USER_ID,
            planId: PLAN_PRO_ID,
            status: 'active',
            stripeSubscriptionId: 'sub_stripe_live_keep',
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
        });

        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ firstName: 'Updated', role: 'farmer' });

        expect(res.status).toBe(200);
        expect(committedState.users.get(TARGET_USER_ID)?.firstName).toBe('Updated');
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('farmer');
        expect(committedState.subscriptions.get(TARGET_USER_ID)?.stripeSubscriptionId).toBe('sub_stripe_live_keep');
        expect(committedState.subscriptions.get(TARGET_USER_ID)?.planId).toBe(PLAN_PRO_ID);
        expect(committedState.usageResetCount).toBe(0);
        expect(committedState.sessions.get(hashToken(victimToken))?.isRevoked).toBe(true);
    });

    it('rolls back user field and role changes when plan reassignment hits 409 Stripe conflict', async () => {
        committedState.subscriptions.set(TARGET_USER_ID, {
            id: 'sub-existing',
            userId: TARGET_USER_ID,
            planId: PLAN_PRO_ID,
            status: 'active',
            stripeSubscriptionId: 'sub_stripe_live_999',
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
        });

        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ firstName: 'Mutated', role: 'farmer', planId: PLAN_ENTERPRISE_ID });

        expect(res.status).toBe(409);
        expect(committedState.users.get(TARGET_USER_ID)?.firstName).toBe('Grace');
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('extension_officer');
        expect(committedState.sessions.get(hashToken(victimToken))?.isRevoked).toBe(false);
        expect(await sharedState.inSet('session:revoked', hashToken(victimToken))).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimToken}`)).status).toBe(200);
    });

    it('rejects with 409 and rolls back role changes if the guarded upsert returns 0 rows due to a concurrent Stripe checkout race', async () => {
        dbOptions.simulateStripeRaceOnUpsert = true;
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'farmer', planId: PLAN_PRO_ID });

        expect(res.status).toBe(409);
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('extension_officer');
        expect(committedState.sessions.get(hashToken(victimToken))?.isRevoked).toBe(false);
        expect(await sharedState.inSet('session:revoked', hashToken(victimToken))).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimToken}`)).status).toBe(200);
        expect(committedState.usageResetCount).toBe(0);
        expect(committedState.changeEvents).toHaveLength(0);
        expect(queryLog.some(entry => entry.sql === 'ROLLBACK')).toBe(true);
    });

    it('allows plan reassignment for a Free user with no existing subscription row', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ planId: PLAN_PRO_ID });

        expect(res.status).toBe(200);
        expect(res.body.data.planId).toBe(PLAN_PRO_ID);
        expect(res.body.data.planName).toBe('Pro');
        expect(committedState.subscriptions.get(TARGET_USER_ID)?.stripeSubscriptionId).toBeNull();
        expect(committedState.usageResetCount).toBe(1);
        expect(queryLog.some(entry => entry.sql.includes('FOR UPDATE OF s'))).toBe(true);
        expect(
            queryLog.some(entry => entry.sql.includes("IN ('canceled', 'expired', 'incomplete_expired')"))
        ).toBe(true);
    });

    it.each([
        { label: 'manual/voucher/M-Pesa (null stripe id)', stripeSubscriptionId: null, status: 'active' },
        { label: 'manual/voucher/M-Pesa (empty stripe id)', stripeSubscriptionId: '', status: 'active' },
        { label: 'manual/voucher/M-Pesa (whitespace stripe id)', stripeSubscriptionId: '   ', status: 'active' },
        { label: 'canceled Stripe subscription', stripeSubscriptionId: 'sub_old_1', status: 'canceled' },
        { label: 'uppercase CANCELED Stripe subscription', stripeSubscriptionId: 'sub_old_2', status: 'CANCELED' },
        { label: 'expired Stripe subscription', stripeSubscriptionId: 'sub_old_3', status: 'expired' },
        { label: 'uppercase EXPIRED Stripe subscription', stripeSubscriptionId: 'sub_old_4', status: 'EXPIRED' },
        { label: 'incomplete_expired Stripe subscription', stripeSubscriptionId: 'sub_old_5', status: 'incomplete_expired' },
        { label: 'uppercase INCOMPLETE_EXPIRED Stripe subscription', stripeSubscriptionId: 'sub_old_6', status: 'INCOMPLETE_EXPIRED' },
    ])('allows reassignment and clears stripe_subscription_id for $label', async ({ stripeSubscriptionId, status }) => {
        committedState.subscriptions.set(TARGET_USER_ID, {
            id: 'sub-existing',
            userId: TARGET_USER_ID,
            planId: PLAN_FREE_ID,
            status,
            stripeSubscriptionId,
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
        });

        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ planId: PLAN_PRO_ID });

        expect(res.status).toBe(200);
        const sub = committedState.subscriptions.get(TARGET_USER_ID);
        expect(sub?.planId).toBe(PLAN_PRO_ID);
        expect(sub?.status).toBe('active');
        expect(sub?.stripeSubscriptionId).toBeNull();
        expect(committedState.usageResetCount).toBe(1);
        expect(committedState.changeEvents).toHaveLength(1);
        expect(committedState.changeEvents[0]).toMatchObject({
            fromPlanId: PLAN_FREE_ID,
            toPlanId: PLAN_PRO_ID,
        });
    });
});

describe('Finding 2 — transactional session revocation & post-commit cache publication', () => {
    it('rolls back role change when session UPDATE fails inside the transaction and keeps revocation caches clean', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');
        dbOptions.failSessionUpdate = true;

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'farmer' });

        expect(res.status).toBe(500);

        const userUpdateCall = queryLog.find(entry => entry.sql.includes('WITH updated AS'));
        const sessionUpdateCall = queryLog.find(entry => entry.sql.includes('UPDATE user_sessions'));
        expect(userUpdateCall?.clientId).toBeDefined();
        expect(sessionUpdateCall?.clientId).toBe(userUpdateCall?.clientId);
        expect(queryLog.some(entry => entry.clientId === userUpdateCall?.clientId && entry.sql === 'ROLLBACK')).toBe(true);
        expect(queryLog.some(entry => entry.clientId === userUpdateCall?.clientId && entry.sql === 'COMMIT')).toBe(false);

        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('extension_officer');
        expect(committedState.sessions.get(hashToken(victimToken))?.isRevoked).toBe(false);
        expect(await sharedState.inSet('session:revoked', hashToken(victimToken))).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimToken}`)).status).toBe(200);
    });

    it('rolls back activation change (deactivation and reactivation) when session UPDATE fails inside the transaction', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');
        dbOptions.failSessionUpdate = true;

        const deactivateRes = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ isActive: false });

        expect(deactivateRes.status).toBe(500);
        expect(committedState.users.get(TARGET_USER_ID)?.isActive).toBe(true);
        expect(committedState.sessions.get(hashToken(victimToken))?.isRevoked).toBe(false);
        expect(await sharedState.inSet('session:revoked', hashToken(victimToken))).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimToken}`)).status).toBe(200);

        committedState.users.get(TARGET_USER_ID)!.isActive = false;
        const reactivateRes = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ isActive: true });

        expect(reactivateRes.status).toBe(500);
        expect(committedState.users.get(TARGET_USER_ID)?.isActive).toBe(false);
    });

    it('does not poison local or shared revocation caches when COMMIT fails after session UPDATE succeeds', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');
        dbOptions.failCommit = true;

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'farmer' });

        expect(res.status).toBe(500);
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('extension_officer');
        expect(committedState.sessions.get(hashToken(victimToken))?.isRevoked).toBe(false);
        expect(await sharedState.inSet('session:revoked', hashToken(victimToken))).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimToken}`)).status).toBe(200);
    });

    it('rolls back both role and plan writes when session UPDATE fails in a combined update', async () => {
        committedState.subscriptions.set(TARGET_USER_ID, {
            id: 'sub-existing',
            userId: TARGET_USER_ID,
            planId: PLAN_FREE_ID,
            status: 'active',
            stripeSubscriptionId: null,
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
        });
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimTokenA = issueToken(TARGET_USER_ID, 'extension_officer');
        const victimTokenB = issueToken(TARGET_USER_ID, 'extension_officer');
        dbOptions.failSessionUpdate = true;

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'farmer', planId: PLAN_PRO_ID });

        expect(res.status).toBe(500);
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('extension_officer');
        expect(committedState.subscriptions.get(TARGET_USER_ID)?.planId).toBe(PLAN_FREE_ID);
        expect(committedState.usageResetCount).toBe(0);
        expect(committedState.changeEvents).toHaveLength(0);
        expect(await sharedState.inSet('session:revoked', hashToken(victimTokenA))).toBe(false);
        expect(await sharedState.inSet('session:revoked', hashToken(victimTokenB))).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimTokenA}`)).status).toBe(200);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimTokenB}`)).status).toBe(200);
    });

    it('acquires the per-user session advisory lock before updating users, commits atomically, and publishes revocation caches', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimTokenA = issueToken(TARGET_USER_ID, 'extension_officer');
        const victimTokenB = issueToken(TARGET_USER_ID, 'extension_officer');

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'farmer' });

        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe('farmer');

        const lockIndex = queryLog.findIndex(
            entry => entry.sql === 'SELECT pg_advisory_xact_lock(hashtext($1))' && entry.params[0] === TARGET_USER_ID
        );
        const userUpdateIndex = queryLog.findIndex(entry => entry.sql.includes('WITH updated AS'));
        const sessionUpdateIndex = queryLog.findIndex(entry => entry.sql.includes('UPDATE user_sessions'));
        expect(lockIndex).toBeGreaterThan(-1);
        expect(userUpdateIndex).toBeGreaterThan(lockIndex);
        expect(sessionUpdateIndex).toBeGreaterThan(userUpdateIndex);

        const clientId = queryLog[userUpdateIndex]?.clientId;
        expect(queryLog[lockIndex]?.clientId).toBe(clientId);
        expect(queryLog[sessionUpdateIndex]?.clientId).toBe(clientId);
        expect(queryLog.some(entry => entry.clientId === clientId && entry.sql === 'COMMIT')).toBe(true);

        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('farmer');
        expect(committedState.sessions.get(hashToken(victimTokenA))?.isRevoked).toBe(true);
        expect(committedState.sessions.get(hashToken(victimTokenB))?.isRevoked).toBe(true);
        expect(await sharedState.inSet('session:revoked', hashToken(victimTokenA))).toBe(true);
        expect(await sharedState.inSet('session:revoked', hashToken(victimTokenB))).toBe(true);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimTokenA}`)).status).toBe(401);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimTokenB}`)).status).toBe(401);
    });

    it('commits cleanly when the user has 0 active sessions and rolls back if session UPDATE fails with 0 sessions', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');

        const okRes = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'farmer' });
        expect(okRes.status).toBe(200);
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('farmer');

        dbOptions.failSessionUpdate = true;
        const failRes = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'regional_manager' });
        expect(failRes.status).toBe(500);
        expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('farmer');
    });

    it('does not acquire the session advisory lock for non-role/non-activation updates', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');

        const res = await request(app)
            .put(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ firstName: 'Renamed', planId: PLAN_PRO_ID });

        expect(res.status).toBe(200);
        expect(queryLog.some(entry => entry.sql === 'SELECT pg_advisory_xact_lock(hashtext($1))')).toBe(false);
        expect(queryLog.some(entry => entry.sql.includes('UPDATE user_sessions'))).toBe(false);
    });

    it('still returns 200 and revokes locally if post-commit sharedState publication throws synchronously or rejects', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimTokenA = issueToken(TARGET_USER_ID, 'extension_officer');
        const victimTokenB = issueToken(TARGET_USER_ID, 'extension_officer');

        const addToSetSpy = jest.spyOn(sharedState, 'addToSet')
            .mockImplementationOnce(() => {
                throw new Error('sync sharedState failure');
            })
            .mockRejectedValueOnce(new Error('async redis timeout'));

        try {
            const res = await request(app)
                .put(`/users/${TARGET_USER_ID}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'farmer' });

            expect(res.status).toBe(200);
            expect(committedState.users.get(TARGET_USER_ID)?.role).toBe('farmer');
            expect(committedState.sessions.get(hashToken(victimTokenA))?.isRevoked).toBe(true);
            expect(committedState.sessions.get(hashToken(victimTokenB))?.isRevoked).toBe(true);
            expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimTokenA}`)).status).toBe(401);
            expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimTokenB}`)).status).toBe(401);
        } finally {
            addToSetSpy.mockRestore();
        }
    });

    it('preserves DELETE /users/:id fail-closed behavior when session revocation fails', async () => {
        const adminToken = issueToken(ADMIN_USER_ID, 'admin');
        const victimToken = issueToken(TARGET_USER_ID, 'extension_officer');
        dbOptions.failSessionUpdate = true;

        const res = await request(app)
            .delete(`/users/${TARGET_USER_ID}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(500);
        expect(committedState.users.get(TARGET_USER_ID)?.isActive).toBe(false);
        expect((await request(app).get('/protected').set('Authorization', `Bearer ${victimToken}`)).status).toBe(401);
    });
});
