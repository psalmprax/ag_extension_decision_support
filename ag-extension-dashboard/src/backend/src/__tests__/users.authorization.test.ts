import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { authorize, UserRole } from '../middleware/authorize';
import { query } from '../services/databaseService';
import { hashToken } from '../services/sessionService';
import usersRouter from '../routes/users';

jest.mock('../services/databaseService', () => ({ getPool: jest.fn(() => ({})), query: jest.fn() }));
jest.mock('../services/cacheService', () => ({ getCache: jest.fn(() => null) }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockQuery = query as jest.Mock;
const sessions = new Map<string, { userId: string; revoked: boolean }>();
let targetActive: boolean;
let revocationFails: boolean;

function token(userId: string, role: UserRole): string {
  const value = jwt.sign({ userId, email: `${userId}@example.test`, role, jti: randomUUID() }, config.jwt.secret, { expiresIn: '1h' });
  sessions.set(hashToken(value), { userId, revoked: false });
  return value;
}

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/users', usersRouter);
app.get('/protected', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), (req, res) => res.json(req.user));

function revokeUserSessions(userId: unknown) {
  if (revocationFails) throw new Error('Session update unavailable');
  const rows: Array<{ token_hash: string }> = [];
  for (const [hash, session] of sessions) {
    if (session.userId === userId && !session.revoked) {
      session.revoked = true;
      rows.push({ token_hash: hash });
    }
  }
  return { rows, rowCount: rows.length };
}

beforeEach(() => {
  targetActive = true;
  revocationFails = false;
  sessions.clear();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM user_sessions')) {
      const session = sessions.get(String(params[0]));
      return { rows: session ? [{ is_revoked: session.revoked, is_active: session.userId !== 'target' || targetActive, expires_at: new Date(Date.now() + 3600000) }] : [], rowCount: session ? 1 : 0 };
    }
    if (sql.includes('UPDATE user_sessions')) {
      return revokeUserSessions(params[0]);
    }
    if (sql.includes('INSERT INTO users')) {
      return { rows: [{ id: 'created', email: params[0], role: params[4], first_name: params[2], last_name: params[3], is_active: true }], rowCount: 1 };
    }
    if (sql.includes('UPDATE users')) {
      targetActive = sql.includes('is_active = false') ? false : params.find(p => typeof p === 'boolean') as boolean;
      return { rows: [{ id: 'target', is_active: targetActive }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
});

describe('user management with real authorization and session validation', () => {
  const newAdmin = { email: 'new@example.test', password: 'long-test-password', firstName: 'Test', lastName: 'Admin', role: 'admin' };

  it('rejects administrator creation by a regional manager before any insert', async () => {
    const response = await request(app).post('/users').set('Authorization', `Bearer ${token('manager', 'regional_manager')}`).send(newAdmin);
    expect(response.status).toBe(403);
    expect(mockQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO users'))).toBe(false);
  });

  it.each(['put', 'delete'] as const)('rejects a regional manager attempting to %s another account', async method => {
    const response = await request(app)[method]('/users/target').set('Authorization', `Bearer ${token('manager', 'regional_manager')}`).send({ isActive: false });
    expect(response.status).toBe(403);
    expect(mockQuery.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
  });

  it('allows an administrator to create an administrator', async () => {
    const response = await request(app).post('/users').set('Authorization', `Bearer ${token('admin', 'admin')}`).send(newAdmin);
    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe('admin');
  });

  it('invalidates both cookie and bearer sessions on deletion', async () => {
    const victim = token('target', 'extension_officer');
    expect((await request(app).get('/protected').set('Cookie', `ag_token=${victim}`)).status).toBe(200);
    const response = await request(app).delete('/users/target').set('Authorization', `Bearer ${token('admin', 'admin')}`);
    expect(response.status).toBe(200);
    expect(sessions.get(hashToken(victim))?.revoked).toBe(true);
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${victim}`)).status).toBe(401);
    expect((await request(app).get('/protected').set('Cookie', `ag_token=${victim}`)).status).toBe(401);
  });

  it.each(['isActive', 'is_active'])('revokes tokens when status is changed through %s, including reactivation', async field => {
    const victim = token('target', 'extension_officer');
    const admin = token('admin', 'admin');
    expect((await request(app).put('/users/target').set('Authorization', `Bearer ${admin}`).send({ [field]: false })).status).toBe(200);
    expect((await request(app).put('/users/target').set('Authorization', `Bearer ${admin}`).send({ [field]: true })).status).toBe(200);
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${victim}`)).status).toBe(401);
  });

  it('denies an already-used session immediately after another replica disables its user', async () => {
    const victim = token('target', 'extension_officer');
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${victim}`)).status).toBe(200);
    targetActive = false;
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${victim}`)).status).toBe(401);
  });

  it('does not report successful deletion when session revocation fails, and still denies the disabled user', async () => {
    const victim = token('target', 'extension_officer');
    revocationFails = true;
    expect((await request(app).delete('/users/target').set('Authorization', `Bearer ${token('admin', 'admin')}`)).status).toBe(500);
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${victim}`)).status).toBe(401);
  });
});
