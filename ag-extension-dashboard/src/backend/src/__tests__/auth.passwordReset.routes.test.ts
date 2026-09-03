/**
 * Route-level tests for forgot/reset password, email verification and refresh
 * rotation. DB is mocked at the `query` boundary so the SQL contracts are pinned.
 */
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const dbQuery = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...a: unknown[]) => dbQuery(...a), getPool: () => null }));

const sendPasswordResetEmail = jest.fn().mockResolvedValue(true);
const sendEmail = jest.fn().mockResolvedValue(true);
jest.mock('@/services/emailService', () => ({ emailService: { sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a), sendEmail: (...a: unknown[]) => sendEmail(...a) } }));

const revokeAllUserSessions = jest.fn().mockResolvedValue(1);
const isSessionValid = jest.fn().mockResolvedValue(true);
const createSession = jest.fn().mockResolvedValue('sess');
const revokeToken = jest.fn();
jest.mock('@/services/sessionService', () => ({
  revokeAllUserSessions: (...a: unknown[]) => revokeAllUserSessions(...a),
  isSessionValid: (...a: unknown[]) => isSessionValid(...a),
  createSession: (...a: unknown[]) => createSession(...a),
  revokeToken: (...a: unknown[]) => revokeToken(...a),
  hashToken: (t: string) => crypto.createHash('sha256').update(t).digest('hex'),
}));

import passwordResetRouter from '@/routes/auth/passwordReset';
import sessionRouter from '@/routes/auth/session';
import { config } from '@/config';

const app = express();
app.use(express.json());
app.use('/auth', passwordResetRouter);
app.use('/auth', sessionRouter);

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('POST /auth/forgot-password', () => {
  beforeEach(() => { dbQuery.mockReset(); sendPasswordResetEmail.mockClear(); });

  it('stores a HASHED token and emails the raw one; response is generic', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', first_name: 'A' }] }).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/auth/forgot-password').send({ email: 'A@Farm.co' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    const [updateSql, params] = dbQuery.mock.calls[1];
    expect(updateSql).toMatch(/SET reset_token = \$1, reset_token_expires/);
    const rawToken = sendPasswordResetEmail.mock.calls[0][1] as string;
    expect(rawToken).toHaveLength(64);
    expect(params[0]).toBe(sha(rawToken)); // only the hash hits the DB
  });

  it('returns the same generic 200 for unknown emails (no enumeration)', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/auth/forgot-password').send({ email: 'nobody@x.co' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('POST /auth/reset-password', () => {
  beforeEach(() => { dbQuery.mockReset(); revokeAllUserSessions.mockClear(); });
  const token = 'a'.repeat(64);

  it('rejects an expired or unknown token', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b', reset_token_expires: new Date(Date.now() - 1000) }] });
    const res = await request(app).post('/auth/reset-password').send({ token, password: 'Kilimo-Bora-2026' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects a weak password against the policy (400 WEAK_PASSWORD)', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'john@b', reset_token_expires: new Date(Date.now() + 60000) }] });
    const res = await request(app).post('/auth/reset-password').send({ token, password: 'john123456' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('WEAK_PASSWORD');
  });

  it('sets a bcrypt hash, clears the token/lockout and revokes all sessions', async () => {
    dbQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b', reset_token_expires: new Date(Date.now() + 60000) }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/auth/reset-password').send({ token, password: 'Kilimo-Bora-2026' });
    expect(res.status).toBe(200);
    const [sql, params] = dbQuery.mock.calls[1];
    expect(sql).toMatch(/password_hash = \$1, reset_token = NULL/);
    expect(sql).toMatch(/failed_login_attempts = 0, lockout_until = NULL/);
    expect(await bcrypt.compare('Kilimo-Bora-2026', params[0])).toBe(true);
    expect(revokeAllUserSessions).toHaveBeenCalledWith('u1');
  });
});

describe('POST /auth/verify-email', () => {
  beforeEach(() => dbQuery.mockReset());
  it('flips email_verified only for a live token', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
    const ok = await request(app).post('/auth/verify-email').send({ token: 'b'.repeat(64) });
    expect(ok.status).toBe(200);
    expect(dbQuery.mock.calls[0][0]).toMatch(/email_verification_expires > NOW\(\)/);
    dbQuery.mockResolvedValueOnce({ rows: [] });
    const bad = await request(app).post('/auth/verify-email').send({ token: 'c'.repeat(64) });
    expect(bad.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(() => { isSessionValid.mockReset().mockResolvedValue(true); createSession.mockClear(); revokeToken.mockClear(); });
  const payload = { userId: 'u1', email: 'a@b', role: 'farmer' };

  it('rotates a valid (even recently expired) token', async () => {
    const expired = jwt.sign(payload, config.jwt.secret as string, { expiresIn: -60 }); // expired 1 minute ago
    const res = await request(app).post('/auth/refresh').send({ token: expired });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(revokeToken).toHaveBeenCalledWith(expired);
    expect(createSession).toHaveBeenCalled();
  });

  it('refuses a revoked session and an MFA-pending token', async () => {
    isSessionValid.mockResolvedValue(false);
    const t = jwt.sign(payload, config.jwt.secret as string, { expiresIn: '1h' });
    expect((await request(app).post('/auth/refresh').send({ token: t })).status).toBe(401);
    isSessionValid.mockResolvedValue(true);
    const pending = jwt.sign({ ...payload, mfaPending: true }, config.jwt.secret as string, { expiresIn: '5m' });
    expect((await request(app).post('/auth/refresh').send({ token: pending })).status).toBe(401);
  });

  it('refuses tokens expired beyond the grace window', async () => {
    const ancient = jwt.sign(payload, config.jwt.secret as string, { expiresIn: -(8 * 24 * 3600) });
    expect((await request(app).post('/auth/refresh').send({ token: ancient })).status).toBe(401);
  });
});
