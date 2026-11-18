import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { hashToken } from '@/services/sessionService';
import usersRouter from '@/routes/users';
import { mapUserPublicRow } from '@/types/dtos/billing';
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
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockQuery = query as jest.Mock;
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

interface FakeState {
  sessions: Map<string, { userId: string; revoked: boolean }>;
  users: Map<string, UserPublicRow>;
  inserted: UserPublicRow[];
}

interface FakeReply {
  rows: unknown[];
  rowCount: number;
}

const EMPTY: FakeReply = { rows: [], rowCount: 0 };

function createState(): FakeState {
  return { sessions: new Map(), users: new Map(), inserted: [] };
}

function userRow(overrides: Partial<UserPublicRow> = {}): UserPublicRow {
  return {
    id: 'u-1',
    email: 'user@example.org',
    first_name: 'Test',
    last_name: 'User',
    role: 'farmer',
    region: 'Rift Valley',
    country: 'Kenya',
    phone: null,
    is_active: true,
    preferred_language: null,
    avatar_url: null,
    last_login: null,
    is_demo: false,
    is_system_admin: false,
    ...overrides,
  };
}

function reply(rows: unknown[]): FakeReply {
  return { rows, rowCount: rows.length };
}

/** Applies `col = $n` assignments from an UPDATE ... statement to the stored row. */
function applyUpdate(row: UserPublicRow, sql: string, values: unknown[]): UserPublicRow {
  const start = sql.indexOf('UPDATE users SET') + 'UPDATE users SET'.length;
  const end = sql.indexOf(' WHERE ');
  const setClause = sql.slice(start, end === -1 ? undefined : end);
  const next = { ...row } as Record<string, unknown>;
  for (const assignment of setClause.split(',')) {
    const match = assignment.trim().match(/^(\w+) = \$(\d+)$/);
    if (match) next[match[1]] = values[Number(match[2]) - 1];
  }
  return next as unknown as UserPublicRow;
}

function handleSession(state: FakeState, sql: string, values: unknown[]): FakeReply | null {
  if (sql.includes('FROM user_sessions')) {
    const session = state.sessions.get(String(values[0]));
    return reply(
      session ? [{ is_revoked: session.revoked, is_active: true, expires_at: FUTURE }] : []
    );
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

function handleSystemAdmin(state: FakeState, sql: string, values: unknown[]): FakeReply | null {
  if (/SELECT is_system_admin FROM users WHERE id = \$1/.test(sql)) {
    const user = state.users.get(String(values[0]));
    return reply(user ? [{ is_system_admin: user.is_system_admin === true }] : []);
  }
  if (sql.includes('COUNT(*)::int AS total')) {
    const total = [...state.users.values()].filter(
      user => user.is_system_admin === true && user.is_active !== false
    ).length;
    return reply([{ total }]);
  }
  if (!sql.includes('SELECT id, role, is_active, is_system_admin FROM users')) return null;

  const user = state.users.get(String(values[0]));
  return reply(
    user
      ? [
          {
            id: user.id,
            role: user.role,
            is_active: user.is_active,
            is_system_admin: user.is_system_admin,
          },
        ]
      : []
  );
}

function handleUserWrites(state: FakeState, sql: string, values: unknown[]): FakeReply | null {
  if (sql.includes('INSERT INTO users')) {
    const created = userRow({
      id: `u-created-${state.inserted.length + 1}`,
      email: String(values[0]),
      first_name: String(values[2]),
      last_name: String(values[3]),
      role: String(values[4]),
      region: values[5] as string | null,
      country: values[6] as string | null,
      phone: values[7] as string | null,
    });
    state.inserted.push(created);
    state.users.set(created.id, created);
    return reply([created]);
  }

  if (sql.includes('UPDATE users SET')) {
    const target = state.users.get(String(values[values.length - 1]));
    if (!target) return EMPTY;
    const updated = applyUpdate(target, sql, values);
    state.users.set(updated.id, updated);
    return reply([updated]);
  }

  if (sql.includes('FROM users WHERE id = $1')) {
    const user = state.users.get(String(values[0]));
    return reply(user ? [user] : []);
  }
  if (sql.includes('FROM users')) return reply([...state.users.values()]);

  return null;
}

function handle(state: FakeState, text: string, params: unknown[] = []): FakeReply {
  const sql = String(text);
  const values = params ?? [];

  const framing =
    sql.startsWith('SAVEPOINT') ||
    sql.startsWith('RELEASE SAVEPOINT') ||
    sql.startsWith('ROLLBACK TO SAVEPOINT') ||
    sql.includes('pg_advisory_xact_lock');
  if (framing) return EMPTY;

  return (
    handleSession(state, sql, values) ??
    handleSystemAdmin(state, sql, values) ??
    handleUserWrites(state, sql, values) ??
    EMPTY
  );
}

const app = express();
app.use(express.json());
app.use('/users', usersRouter);

let state: FakeState;

beforeEach(() => {
  state = createState();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) =>
    handle(state, sql, params)
  );
});

function tokenFor(userId: string): string {
  const user = state.users.get(userId);
  if (!user) throw new Error(`Unknown fixture user ${userId}`);
  const token = jwt.sign(
    { userId, email: user.email, role: user.role, jti: randomUUID() },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  state.sessions.set(hashToken(token), { userId, revoked: false });
  return token;
}

function plainAdmin(): string {
  state.users.set('plain-admin', userRow({ id: 'plain-admin', email: 'plain@example.org', role: 'admin' }));
  return tokenFor('plain-admin');
}

function systemAdmin(): string {
  state.users.set(
    'root',
    userRow({ id: 'root', email: 'root@example.org', role: 'admin', is_system_admin: true })
  );
  return tokenFor('root');
}

describe('System administrator gate on user management', () => {
  it('refuses an ordinary admin creating another admin', async () => {
    const token = plainAdmin();

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'new-admin@example.org',
        password: 'password123',
        firstName: 'New',
        lastName: 'Admin',
        role: 'admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('SYSTEM_ADMIN_REQUIRED');
    expect(state.inserted).toHaveLength(0);
  });

  it('lets the system administrator create an admin', async () => {
    const token = systemAdmin();

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'new-admin@example.org',
        password: 'password123',
        firstName: 'New',
        lastName: 'Admin',
        role: 'admin',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ role: 'admin', email: 'new-admin@example.org' });
    expect(state.inserted[0]).toMatchObject({ role: 'admin', is_system_admin: false });
  });

  it('still lets an ordinary admin create non-admin accounts', async () => {
    const token = plainAdmin();

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer@example.org',
        password: 'password123',
        firstName: 'Field',
        lastName: 'Officer',
        role: 'extension_officer',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('extension_officer');
  });

  it('refuses an ordinary admin promoting an officer to admin', async () => {
    const token = plainAdmin();
    state.users.set(
      'officer',
      userRow({ id: 'officer', email: 'officer@example.org', role: 'extension_officer' })
    );

    const res = await request(app)
      .put('/users/officer')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('SYSTEM_ADMIN_REQUIRED');
    expect(state.users.get('officer')?.role).toBe('extension_officer');
  });

  it('lets the system administrator promote an officer to admin', async () => {
    const token = systemAdmin();
    state.users.set(
      'officer',
      userRow({ id: 'officer', email: 'officer@example.org', role: 'extension_officer' })
    );

    const res = await request(app)
      .put('/users/officer')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
    expect(state.users.get('officer')?.role).toBe('admin');
  });

  it('refuses an ordinary admin deactivating the system administrator', async () => {
    const token = plainAdmin();
    state.users.set(
      'root',
      userRow({ id: 'root', email: 'root@example.org', role: 'admin', is_system_admin: true })
    );

    const res = await request(app)
      .put('/users/root')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
    expect(state.users.get('root')?.is_active).toBe(true);
  });

  it('never allows the last active system administrator to be deactivated', async () => {
    const token = systemAdmin();
    state.users.set(
      'second',
      userRow({ id: 'second', email: 'second@example.org', role: 'admin', is_system_admin: true })
    );

    // Two active system admins: deactivating one is allowed.
    const first = await request(app)
      .put('/users/second')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(first.status).toBe(200);
    expect(state.users.get('second')?.is_active).toBe(false);

    // Now only the acting admin is left: the account cannot be deactivated.
    const last = await request(app)
      .delete('/users/root')
      .set('Authorization', `Bearer ${token}`);
    expect(last.status).toBe(400);
    expect(last.body.errorCode).toBe('LAST_SYSTEM_ADMIN');
    expect(state.users.get('root')?.is_active).toBe(true);
  });

  it('exposes the flag on the user directory', async () => {
    const token = systemAdmin();
    state.users.set(
      'officer',
      userRow({ id: 'officer', email: 'officer@example.org', role: 'extension_officer' })
    );

    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'root', isSystemAdmin: true }),
        expect.objectContaining({ id: 'officer', isSystemAdmin: false }),
      ])
    );
  });

  it('treats a row from before the migration as a non-system admin', () => {
    const legacyRow = userRow();
    delete legacyRow.is_system_admin;

    expect(mapUserPublicRow(legacyRow).isSystemAdmin).toBe(false);
  });
});
