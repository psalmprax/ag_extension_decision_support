import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { hashToken } from '@/services/sessionService';
import usersRouter from '@/routes/users';

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
const sessions = new Map<string, { userId: string; revoked: boolean }>();

const FREE_PLAN_ID = '00000000-0000-0000-0000-000000000001';
const PRO_PLAN_ID = '00000000-0000-0000-0000-000000000002';

function makeToken(userId: string, role: string): string {
  const token = jwt.sign(
    { userId, email: `${userId}@example.test`, role, jti: randomUUID() },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  sessions.set(hashToken(token), { userId, revoked: false });
  return token;
}

const app = express();
app.use(express.json());
app.use('/users', usersRouter);

describe('Admin user access & subscription tier management', () => {
  beforeEach(() => {
    sessions.clear();
    mockQuery.mockReset();
  });

  it('GET /users includes active subscription plan info (Free vs Pro vs Admin)', async () => {
    const adminToken = makeToken('admin-1', 'admin');
    const future = new Date(Date.now() + 86400_000).toISOString();

    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: hit.revoked, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('FROM users')) {
        return {
          rows: [
            {
              id: 'u-pro',
              email: 'pro@example.org',
              first_name: 'Pro',
              last_name: 'Officer',
              role: 'extension_officer',
              region: 'Rift Valley',
              country: 'Kenya',
              phone: null,
              is_active: true,
              preferred_language: null,
              avatar_url: null,
              last_login: null,
              is_demo: false,
              plan_id: PRO_PLAN_ID,
              plan_name: 'Pro',
              plan_price: '29.00',
              subscription_status: 'active',
              subscription_period_end: future,
            },
            {
              id: 'u-free',
              email: 'free@example.org',
              first_name: 'Basic',
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
              plan_id: null,
              plan_name: null,
              plan_price: null,
              subscription_status: null,
              subscription_period_end: null,
            },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    });

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
    expect(res.body.data[1]).toMatchObject({
      id: 'u-free',
      planId: null,
      planName: 'Free',
      isFree: true,
    });
  });

  it('PUT /users/:id lets admin upgrade a basic user to Pro without revoking sessions when role/isActive unchanged', async () => {
    const adminToken = makeToken('admin-1', 'admin');
    const future = new Date(Date.now() + 86400_000).toISOString();
    const sqlHistory: string[] = [];

    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      sqlHistory.push(sql);
      if (sql.includes('pg_advisory_xact_lock') || sql.startsWith('SAVEPOINT') || sql.startsWith('RELEASE SAVEPOINT') || sql.startsWith('ROLLBACK TO SAVEPOINT')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: hit.revoked, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: PRO_PLAN_ID, name: 'Pro', price: '29.00', interval: 'month' }], rowCount: 1 };
      }
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{
            id: 'u-basic',
            email: 'basic@example.org',
            first_name: 'Basic',
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
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM subscriptions s')) {
        return { rows: [{ id: 'sub-1', plan_id: FREE_PLAN_ID, price: '0.00' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        return { rows: [{ id: 'sub-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

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
    expect(sqlHistory.some(s => s.includes('UPDATE user_sessions'))).toBe(false);
    expect(sqlHistory.some(s => s.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(sqlHistory.some(s => s.includes('INSERT INTO subscriptions') && s.includes('stripe_subscription_id = NULL'))).toBe(true);
    expect(
      sqlHistory.some(
        s =>
          s.includes('INSERT INTO usage') &&
          s.includes('sms_count = 0') &&
          s.includes('ai_chat_count = 0') &&
          s.includes('report_count = 0') &&
          s.includes('ai_vision_count = 0') &&
          s.includes('speech_count = 0') &&
          s.includes('whatsapp_count = 0')
      )
    ).toBe(true);
    expect(sqlHistory.some(s => s.includes('INSERT INTO subscription_change_events'))).toBe(true);

    const lockIdx = sqlHistory.findIndex(s => s.includes('pg_advisory_xact_lock'));
    const prevReadIdx = sqlHistory.findIndex(s => s.includes('FROM subscriptions s'));
    expect(lockIdx).toBeGreaterThan(-1);
    expect(lockIdx).toBeLessThan(prevReadIdx);
  });

  it('PUT /users/:id lets admin update role, active status, and planId together and revokes sessions', async () => {
    const adminToken = makeToken('admin-1', 'admin');
    const future = new Date(Date.now() + 86400_000).toISOString();
    const sqlHistory: string[] = [];

    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      sqlHistory.push(sql);
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: hit.revoked, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: FREE_PLAN_ID, name: 'Free', price: '0.00', interval: 'month' }], rowCount: 1 };
      }
      if (sql.includes('UPDATE users SET')) {
        return {
          rows: [{
            id: 'u-target',
            email: 'target@example.org',
            first_name: 'Target',
            last_name: 'User',
            role: 'extension_officer',
            region: 'Western',
            country: 'Kenya',
            phone: null,
            is_active: false,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        return { rows: [{ id: 'sub-2' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .put('/users/u-target')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'extension_officer', isActive: false, planId: FREE_PLAN_ID });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      role: 'extension_officer',
      isActive: false,
      planId: FREE_PLAN_ID,
      planName: 'Free',
      isFree: true,
    });
    expect(sqlHistory.some(s => s.includes('UPDATE user_sessions'))).toBe(true);
  });

  it('PUT /users/:id rejects unknown/inactive planId (400) and regional_manager callers (403)', async () => {
    const adminToken = makeToken('admin-1', 'admin');
    const rmToken = makeToken('rm-1', 'regional_manager');
    const future = new Date(Date.now() + 86400_000).toISOString();

    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: false, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      return { rows: [], rowCount: 0 };
    });

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
  });

  it('field-only PUT /users/:id preserves joined Pro subscription info and skips session revocation on rollback', async () => {
    const adminToken = makeToken('admin-1', 'admin');
    const future = new Date(Date.now() + 86400_000).toISOString();
    const sqlHistory: string[] = [];

    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      sqlHistory.push(sql);
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: false, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('UPDATE users SET')) {
        return {
          rows: [{
            id: 'u-pro',
            email: 'pro@example.org',
            first_name: 'Updated',
            last_name: 'Officer',
            role: 'extension_officer',
            region: 'Rift Valley',
            country: 'Kenya',
            phone: null,
            is_active: true,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
            is_demo: false,
            plan_id: PRO_PLAN_ID,
            plan_name: 'Pro',
            plan_price: '29.00',
            subscription_status: 'active',
            subscription_period_end: future,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const fieldOnlyRes = await request(app)
      .put('/users/u-pro')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Updated' });

    expect(fieldOnlyRes.status).toBe(200);
    expect(fieldOnlyRes.body.data).toMatchObject({
      firstName: 'Updated',
      planId: PRO_PLAN_ID,
      planName: 'Pro',
      planStatus: 'active',
      isFree: false,
    });
    expect(
      sqlHistory.some(
        s =>
          s.includes('UPDATE users SET') &&
          s.includes('LEFT JOIN subscriptions s') &&
          s.includes('LEFT JOIN subscription_plans sp')
      )
    ).toBe(true);
    expect(sqlHistory.some(s => s.includes('UPDATE user_sessions'))).toBe(false);

    // Role change whose transaction fails in assignUserPlan must NOT revoke sessions post-commit
    sqlHistory.length = 0;
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      sqlHistory.push(sql);
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: false, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: PRO_PLAN_ID, name: 'Pro', price: '29.00', interval: 'month' }], rowCount: 1 };
      }
      if (sql.includes('UPDATE users SET')) {
        return {
          rows: [{
            id: 'u-pro',
            email: 'pro@example.org',
            first_name: 'Pro',
            last_name: 'Officer',
            role: 'regional_manager',
            region: 'Rift Valley',
            country: 'Kenya',
            phone: null,
            is_active: true,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
            is_demo: false,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        throw new Error('Simulated DB error');
      }
      return { rows: [], rowCount: 0 };
    });

    const failRes = await request(app)
      .put('/users/u-pro')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'regional_manager', planId: PRO_PLAN_ID });

    expect(failRes.status).toBe(500);
    expect(sqlHistory.some(s => s.includes('UPDATE user_sessions'))).toBe(false);
  });

  it('POST /users with planId assigns subscription in the same transaction and rolls back on failure', async () => {
    const adminToken = makeToken('admin-1', 'admin');
    const future = new Date(Date.now() + 86400_000).toISOString();

    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: false, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: PRO_PLAN_ID, name: 'Pro', price: '29.00', interval: 'month' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [{
            id: 'u-created-pro',
            email: params[0],
            first_name: params[2],
            last_name: params[3],
            role: params[4],
            region: null,
            country: 'Kenya',
            phone: null,
            is_active: true,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        return { rows: [{ id: 'sub-new' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const okRes = await request(app)
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

    expect(okRes.status).toBe(201);
    expect(okRes.body.data).toMatchObject({
      id: 'u-created-pro',
      planId: PRO_PLAN_ID,
      planName: 'Pro',
      planStatus: 'active',
      isFree: false,
    });

    // Failure during plan assignment rejects the transaction with 500
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return { rows: hit ? [{ is_revoked: false, is_active: true, expires_at: future }] : [], rowCount: hit ? 1 : 0 };
      }
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: PRO_PLAN_ID, name: 'Pro', price: '29.00', interval: 'month' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [{
            id: 'u-rollback',
            email: params[0],
            first_name: params[2],
            last_name: params[3],
            role: params[4],
            region: null,
            country: 'Kenya',
            phone: null,
            is_active: true,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        throw new Error('Subscription write failed');
      }
      return { rows: [], rowCount: 0 };
    });

    const rollbackRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'rollback@example.org',
        password: 'password123',
        firstName: 'Roll',
        lastName: 'Back',
        planId: PRO_PLAN_ID,
      });

    expect(rollbackRes.status).toBe(500);
  });
});
