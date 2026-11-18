import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { authorize } from '@/middleware/authorize';
import { hashToken } from '@/services/sessionService';
import usersRouter from '@/routes/users';
import type { UserPublicRow } from '@/types/rowTypes';

jest.mock('@/services/databaseService', () => {
  const query = jest.fn();
  const txClient = {
    query: jest.fn((sql: string, params?: unknown[]) => query(sql, params)),
  };
  return {
    getPool: jest.fn(() => ({})),
    query,
    withTransaction: jest.fn(async (cb: (client: typeof txClient) => Promise<unknown>) => cb(txClient)),
  };
});
jest.mock('@/services/cacheService', () => ({ getCache: jest.fn(() => null) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockQuery = query as jest.Mock;

const FREE_PLAN_ID = '00000000-0000-0000-0000-000000000001';
const PRO_PLAN_ID = '00000000-0000-0000-0000-000000000002';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

interface PlanFixture {
  id: string;
  name: string;
  price: string;
  interval: string;
}

/**
 * In-memory stand-in for the tables these routes touch. The route is exercised
 * end to end (HTTP -> transaction -> write); assertions are made against the
 * state it produced (rows written, sessions revoked, response body) rather than
 * against the SQL text, so a query rewrite does not fail an unrelated test.
 */
interface FakeState {
  sessions: Map<string, { userId: string; revoked: boolean }>;
  users: Map<string, UserPublicRow>;
  plans: Map<string, PlanFixture>;
  subscriptions: Map<string, { id: string; plan_id: string; price: string }>;
  changeEvents: unknown[][];
  usageResets: unknown[][];
  subscriptionWrites: unknown[][];
  previousPlanReads: number;
  planReadsOutsideLock: number;
  lockHeld: boolean;
}

interface FakeReply {
  rows: unknown[];
  rowCount: number;
}

function createState(): FakeState {
  return {
    sessions: new Map(),
    users: new Map(),
    plans: new Map([
      [FREE_PLAN_ID, { id: FREE_PLAN_ID, name: 'Free', price: '0.00', interval: 'month' }],
      [PRO_PLAN_ID, { id: PRO_PLAN_ID, name: 'Pro', price: '29.00', interval: 'month' }],
    ]),
    subscriptions: new Map(),
    changeEvents: [],
    usageResets: [],
    subscriptionWrites: [],
    previousPlanReads: 0,
    planReadsOutsideLock: 0,
    lockHeld: false,
  };
}

function userRow(overrides: Partial<UserPublicRow> = {}): UserPublicRow {
  return {
    id: 'u-1',
    email: 'user@example.org',
    first_name: 'Test',
    last_name: 'User',
    role: 'farmer',
    region: 'Central',
    country: 'Kenya',
    phone: null,
    is_active: true,
    preferred_language: null,
    avatar_url: null,
    last_login: null,
    is_demo: false,
    ...overrides,
  };
}

type ReplyFn = (rows: unknown[]) => FakeReply;

const EMPTY: FakeReply = { rows: [], rowCount: 0 };

/** Transaction framing: the advisory lock and the savepoint that opens each one. */
function handleTransactionStatement(state: FakeState, sql: string): FakeReply | null {
  if (sql.includes('pg_advisory_xact_lock')) {
    state.lockHeld = true;
    return EMPTY;
  }
  // runWithColumnFallback opens a savepoint as the first statement of every
  // mutating transaction, so the per-user lock guarantee is checked per request.
  if (sql.startsWith('SAVEPOINT')) {
    state.lockHeld = false;
    return EMPTY;
  }
  if (sql.startsWith('RELEASE SAVEPOINT') || sql.startsWith('ROLLBACK TO SAVEPOINT')) {
    return EMPTY;
  }
  return null;
}

function handleSessionStatement(state: FakeState, sql: string, values: unknown[], reply: ReplyFn): FakeReply | null {
  if (sql.includes('FROM user_sessions')) {
    const session = state.sessions.get(String(values[0]));
    return reply(session ? [{ is_revoked: session.revoked, is_active: true, expires_at: FUTURE }] : []);
  }
  if (!sql.includes('UPDATE user_sessions')) return null;

  const revoked: unknown[] = [];
  for (const [tokenHash, session] of state.sessions) {
    if (session.userId !== values[0] || session.revoked) continue;
    session.revoked = true;
    revoked.push({ token_hash: tokenHash });
  }
  return reply(revoked);
}

function handleSubscriptionStatement(
  state: FakeState,
  sql: string,
  values: unknown[],
  reply: ReplyFn
): FakeReply | null {
  if (sql.includes('FROM subscription_plans')) {
    const plan = state.plans.get(String(values[0]));
    return reply(plan ? [plan] : []);
  }
  if (sql.includes('FROM subscriptions s')) return readPreviousPlan(state, values, reply);
  if (sql.includes('INSERT INTO subscriptions')) return writeSubscription(state, values, reply);
  if (sql.includes('INSERT INTO usage')) {
    state.usageResets.push(values);
    return reply([]);
  }
  if (!sql.includes('INSERT INTO subscription_change_events')) return null;

  state.changeEvents.push(values);
  return reply([]);
}

function readPreviousPlan(state: FakeState, values: unknown[], reply: ReplyFn): FakeReply {
  state.previousPlanReads += 1;
  // The previous plan must be read while the user's advisory lock is held,
  // otherwise two concurrent upgrades could log a stale from_plan_id.
  if (!state.lockHeld) {
    state.planReadsOutsideLock += 1;
    throw new Error('previous subscription read happened outside the advisory lock');
  }
  const subscription = state.subscriptions.get(String(values[0]));
  return reply(subscription ? [subscription] : []);
}

function writeSubscription(state: FakeState, values: unknown[], reply: ReplyFn): FakeReply {
  state.subscriptionWrites.push(values);
  const userId = String(values[0]);
  const existing = state.subscriptions.get(userId);
  const id = existing?.id ?? `sub-${userId}`;
  const plan = state.plans.get(String(values[1]));
  state.subscriptions.set(userId, { id, plan_id: String(values[1]), price: plan?.price ?? '0.00' });
  return reply([{ id }]);
}

function handleUserStatement(state: FakeState, sql: string, values: unknown[], reply: ReplyFn): FakeReply {
  if (sql.includes('INSERT INTO users')) {
    return reply([
      userRow({
        id: 'u-created',
        email: String(values[0]),
        first_name: String(values[2]),
        last_name: String(values[3]),
        role: String(values[4]),
      }),
    ]);
  }
  if (sql.includes('UPDATE users SET')) return readUser(state, values[values.length - 1], reply);
  if (sql.includes('users.id = $1') || sql.includes('FROM users WHERE id = $1')) {
    return readUser(state, values[0], reply);
  }
  if (sql.includes('FROM users')) return reply([...state.users.values()]);
  return reply([]);
}

function readUser(state: FakeState, userId: unknown, reply: ReplyFn): FakeReply {
  const user = state.users.get(String(userId));
  return reply(user ? [user] : []);
}

/** Emulates the statements the route issues, keyed by the shape of each statement. */
function handle(state: FakeState, text: string, params: unknown[] = []): FakeReply {
  const sql = String(text);
  const values = params ?? [];
  const reply: ReplyFn = rows => ({ rows, rowCount: rows.length });

  return (
    handleTransactionStatement(state, sql) ??
    handleSessionStatement(state, sql, values, reply) ??
    handleSubscriptionStatement(state, sql, values, reply) ??
    handleUserStatement(state, sql, values, reply)
  );
}

const app = express();
app.use(express.json());
app.use('/users', usersRouter);
app.get(
  '/protected',
  authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']),
  (_req, res) => res.json({ success: true })
);

let state: FakeState;

function tokenFor(userId: string, role: string): string {
  const token = jwt.sign(
    { userId, email: `${userId}@example.test`, role, jti: randomUUID() },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  state.sessions.set(hashToken(token), { userId, revoked: false });
  return token;
}

beforeEach(() => {
  state = createState();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => handle(state, sql, params));
});

describe('Admin user access & subscription tier management', () => {
  it('GET /users reports each user with their current plan tier', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    state.users.set(
      'u-pro',
      userRow({
        id: 'u-pro',
        email: 'pro@example.org',
        plan_id: PRO_PLAN_ID,
        plan_name: 'Pro',
        plan_price: '29.00',
        subscription_status: 'active',
        subscription_period_end: FUTURE,
      })
    );
    state.users.set('u-free', userRow({ id: 'u-free', email: 'free@example.org' }));

    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: 'u-pro',
      planId: PRO_PLAN_ID,
      planName: 'Pro',
      planStatus: 'active',
      isFree: false,
    });
    expect(res.body.data[1]).toMatchObject({ id: 'u-free', planId: null, planName: 'Free', isFree: true });
  });

  it('PUT /users/:id upgrades the plan, resets usage, records the change and leaves sessions alone', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    const userToken = tokenFor('u-basic', 'farmer');
    state.users.set('u-basic', userRow({ id: 'u-basic', email: 'basic@example.org' }));
    state.subscriptions.set('u-basic', { id: 'sub-1', plan_id: FREE_PLAN_ID, price: '0.00' });

    const res = await request(app)
      .put('/users/u-basic')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: PRO_PLAN_ID });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'u-basic',
      planId: PRO_PLAN_ID,
      planName: 'Pro',
      planStatus: 'active',
      isFree: false,
    });

    // One upgrade from Free (0.00) to Pro (29.00) was recorded against the existing subscription.
    expect(state.changeEvents).toEqual([['sub-1', FREE_PLAN_ID, PRO_PLAN_ID, 0, 29]]);
    // The new period starts with zeroed counters.
    expect(state.usageResets).toEqual([['sub-1']]);
    expect(state.subscriptions.get('u-basic')).toMatchObject({ id: 'sub-1', plan_id: PRO_PLAN_ID });
    // The previous plan was read (for the change event) and only under the lock.
    expect(state.previousPlanReads).toBe(1);
    expect(state.planReadsOutsideLock).toBe(0);

    // Changing a subscription is not a credential change: the session still works.
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${userToken}`)).status).toBe(200);
  });

  it('PUT /users/:id does not record a change event when the plan is unchanged', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    state.users.set('u-pro', userRow({ id: 'u-pro' }));
    state.subscriptions.set('u-pro', { id: 'sub-9', plan_id: PRO_PLAN_ID, price: '29.00' });

    const res = await request(app)
      .put('/users/u-pro')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: PRO_PLAN_ID });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'u-pro', planId: PRO_PLAN_ID, planName: 'Pro' });
    expect(state.changeEvents).toEqual([]);
    expect(state.subscriptions.get('u-pro')).toMatchObject({ id: 'sub-9', plan_id: PRO_PLAN_ID });
  });

  it('PUT /users/:id revokes sessions when the role changes with the plan', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    const targetToken = tokenFor('u-target', 'extension_officer');
    state.users.set('u-target', userRow({ id: 'u-target', role: 'extension_officer', is_active: false }));

    const res = await request(app)
      .put('/users/u-target')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'extension_officer', isActive: false, planId: FREE_PLAN_ID });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'extension_officer', isActive: false, planName: 'Free' });
    // Roles ride inside the JWT, so the target's existing token must stop working.
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${targetToken}`)).status).toBe(401);
  });

  it('PUT /users/:id preserves the joined plan on a field-only update', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    state.users.set(
      'u-pro',
      userRow({
        id: 'u-pro',
        first_name: 'Updated',
        plan_id: PRO_PLAN_ID,
        plan_name: 'Pro',
        plan_price: '29.00',
        subscription_status: 'active',
        subscription_period_end: FUTURE,
      })
    );

    const res = await request(app)
      .put('/users/u-pro')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: 'Updated',
      planId: PRO_PLAN_ID,
      planName: 'Pro',
      planStatus: 'active',
      isFree: false,
    });
  });

  it('PUT /users/:id keeps sessions alive when the plan write fails and the transaction rolls back', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    const targetToken = tokenFor('u-rollback', 'extension_officer');
    state.users.set('u-rollback', userRow({ id: 'u-rollback' }));
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (String(sql).includes('INSERT INTO subscriptions')) throw new Error('Simulated DB error');
      return handle(state, sql, params);
    });

    const res = await request(app)
      .put('/users/u-rollback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'regional_manager', planId: PRO_PLAN_ID });

    expect(res.status).toBe(500);
    // Revocation happens post-commit only: a failed write must not log the user out.
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${targetToken}`)).status).toBe(200);
  });

  it('PUT /users/:id rejects an unknown/inactive or malformed planId (400) and regional managers (403)', async () => {
    const adminToken = tokenFor('admin-1', 'admin');
    const rmToken = tokenFor('rm-1', 'regional_manager');
    state.plans.delete(PRO_PLAN_ID);

    const badFormat = await request(app)
      .put('/users/u-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: 'not-a-uuid' });
    expect(badFormat.status).toBe(400);

    const inactivePlan = await request(app)
      .put('/users/u-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: PRO_PLAN_ID });
    expect(inactivePlan.status).toBe(400);

    const rmRes = await request(app)
      .put('/users/u-1')
      .set('Authorization', `Bearer ${rmToken}`)
      .send({ planId: PRO_PLAN_ID });
    expect(rmRes.status).toBe(403);

    expect(state.subscriptionWrites).toEqual([]);
  });

  it('POST /users assigns the plan in the same transaction, and returns 500 when that write fails', async () => {
    const adminToken = tokenFor('admin-1', 'admin');

    const created = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'new-pro@example.org',
        password: 'password123',
        firstName: 'New',
        lastName: 'Pro',
        role: 'extension_officer',
        planId: PRO_PLAN_ID,
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      id: 'u-created',
      planId: PRO_PLAN_ID,
      planName: 'Pro',
      planStatus: 'active',
      isFree: false,
    });
    expect(state.subscriptionWrites).toHaveLength(1);
    expect(state.subscriptionWrites[0]?.[1]).toBe(PRO_PLAN_ID);

    state.subscriptionWrites.length = 0;
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (String(sql).includes('INSERT INTO subscriptions')) throw new Error('Subscription write failed');
      return handle(state, sql, params);
    });

    const rolledBack = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'rollback@example.org',
        password: 'password123',
        firstName: 'Roll',
        lastName: 'Back',
        planId: PRO_PLAN_ID,
      });

    expect(rolledBack.status).toBe(500);
  });
});
