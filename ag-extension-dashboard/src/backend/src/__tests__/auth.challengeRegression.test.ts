import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import loginRouter from '../routes/auth/login';
import mfaRouter from '../routes/auth/mfa';
import { query } from '../services/databaseService';
import { matchTotpStep, verifyAndConsumeBackupCode } from '../services/mfaService';
import { isAccountLocked, recordFailedLogin, resetFailedAttempts } from '../services/lockoutService';
import { recordLoginAttempt } from '../services/loginHistoryService';
import { createSession } from '../services/sessionService';
import { setAuthCookie } from '../middleware/authCookie';

jest.mock('../config', () => ({ config: { jwt: { secret: 'challenge-test-secret', expiresIn: '1h' } } }));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../services/mfaService', () => ({ matchTotpStep: jest.fn(), verifyAndConsumeBackupCode: jest.fn() }));
jest.mock('../services/lockoutService', () => ({
  isAccountLocked: jest.fn(), recordFailedLogin: jest.fn(), resetFailedAttempts: jest.fn(),
}));
jest.mock('../services/loginHistoryService', () => ({
  recordLoginAttempt: jest.fn(), resolveLocationFromHeaders: jest.fn(),
}));
jest.mock('../services/sessionService', () => ({ createSession: jest.fn() }));
jest.mock('../services/sharedState', () => ({ setWithTtl: jest.fn(), getTtl: jest.fn(), delKey: jest.fn() }));
jest.mock('../middleware/authCookie', () => ({ setAuthCookie: jest.fn() }));
jest.mock('../middleware/auditMiddleware', () => ({
  auditMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('../utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

const app = express();
app.use(express.json(), loginRouter, mfaRouter);
const mockQuery = query as jest.Mock;
const makeUser = () => ({
  id: 'user-1', email: 'farmer@example.com', role: 'farmer', is_demo: false,
  password_hash: 'password-hash', mfa_enabled: true, mfa_secret: 'secret',
  mfa_backup_codes: ['hashed-backup'], last_totp_step: 119 as number | string | null,
});
let user = makeUser();

function verifyChallenge(isBackupCode = false) {
  const tempToken = jwt.sign({ userId: user.id, email: user.email, mfaPending: true }, 'challenge-test-secret', {
    algorithm: 'HS256', expiresIn: '5m',
  });
  return request(app).post('/mfa/verify').send({ tempToken, code: '123456', isBackupCode });
}

beforeEach(() => {
  jest.resetAllMocks();
  user = makeUser();
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT * FROM users')) return { rows: [user] };
    if (sql.startsWith('UPDATE users SET last_totp_step')) return { rows: [{ id: user.id }] };
    return { rows: [] };
  });
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  (isAccountLocked as jest.Mock).mockReturnValue({ locked: false });
  (recordFailedLogin as jest.Mock).mockResolvedValue({ locked: false, remainingAttempts: 4 });
  (matchTotpStep as jest.Mock).mockReturnValue(120);
  (verifyAndConsumeBackupCode as jest.Mock).mockResolvedValue({ valid: true });
});

describe('MFA challenge regression guards', () => {
  it('rejects a locked account before checking or consuming any code', async () => {
    (isAccountLocked as jest.Mock).mockReturnValue({ locked: true, remainingSeconds: 60 });
    const res = await verifyChallenge(true);
    expect(res.status).toBe(423);
    expect(matchTotpStep).not.toHaveBeenCalled();
    expect(verifyAndConsumeBackupCode).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([120, '120', 121])('rejects a TOTP at or before the saved step %s', async lastStep => {
    user.last_totp_step = lastStep;
    (recordFailedLogin as jest.Mock).mockResolvedValue({ locked: true, remainingAttempts: 0 });
    const res = await verifyChallenge();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('That code was already used. Wait for the next code.');
    expect(recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ failureReason: 'totp_code_replayed' }));
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
    expect(setAuthCookie).not.toHaveBeenCalled();
  });

  it('rejects the losing request when another verifier claims the same step', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [user] }).mockResolvedValueOnce({ rows: [] });
    const res = await verifyChallenge();
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('already used');
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('last_totp_step < $1'), [120, user.id]);
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([null, 119])('creates a full session only after claiming a fresh step (previous %s)', async previous => {
    user.last_totp_step = previous;
    const res = await verifyChallenge();
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('last_totp_step < $1'), [120, user.id]);
    expect(resetFailedAttempts).toHaveBeenCalledWith(user.id);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id, token: res.body.data.token }));
    expect(jwt.verify(res.body.data.token, 'challenge-test-secret', { algorithms: ['HS256'] })).toMatchObject({
      userId: user.id, role: user.role,
    });
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), res.body.data.token);
  });

  it.each([false, true])('records an invalid TOTP with the expected lockout response (locked=%s)', async locked => {
    (matchTotpStep as jest.Mock).mockReturnValue(null);
    (recordFailedLogin as jest.Mock).mockResolvedValue({ locked, remainingAttempts: 2 });
    const res = await verifyChallenge();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(locked
      ? 'Too many invalid codes. Account temporarily locked.'
      : 'Invalid verification code. 2 attempt(s) remaining.');
    expect(recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ failureReason: 'invalid_totp_code' }));
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('consumes a valid backup code without checking the TOTP watermark', async () => {
    const res = await verifyChallenge(true);
    expect(res.status).toBe(200);
    expect(verifyAndConsumeBackupCode).toHaveBeenCalledWith(user.id, '123456', user.mfa_backup_codes);
    expect(matchTotpStep).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), expect.anything());
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('counts an invalid backup code as a failed login', async () => {
    (verifyAndConsumeBackupCode as jest.Mock).mockResolvedValue({ valid: false });
    const res = await verifyChallenge(true);
    expect(res.status).toBe(401);
    expect(recordFailedLogin).toHaveBeenCalledWith(user.id);
    expect(recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ failureReason: 'invalid_backup_code' }));
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe('Login subscription presentation', () => {
  beforeEach(() => { user.mfa_enabled = false; });

  it.each([
    { role: 'admin', demo: false, email: 'admin@example.com', planName: 'Admin', isFree: false },
    { role: 'farmer', demo: true, email: 'farmer@example.com', planName: 'Free', isFree: true },
    { role: 'farmer', demo: false, email: 'demo@agridemo.com', planName: 'Free', isFree: true },
  ])('preserves plan handling for $role/$email (demo=$demo)', async row => {
    Object.assign(user, { role: row.role, email: row.email, is_demo: row.demo });
    const res = await request(app).post('/login').send({ email: user.email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ planName: row.planName, isFree: row.isFree });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it.each([
    { plan_name: 'Pro', price: '20', isFree: false },
    { plan_name: 'Trial', price: '0', isFree: true },
    { plan_name: 'Free tier', price: '20', isFree: true },
    { plan_name: 'Pro', price: null, isFree: true },
  ])('preserves plan and price interpretation for $plan_name/$price', async row => {
    mockQuery.mockResolvedValueOnce({ rows: [user] }).mockResolvedValueOnce({ rows: [row] });
    const res = await request(app).post('/login').send({ email: user.email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ planName: row.plan_name, isFree: row.isFree });
    expect(mockQuery).toHaveBeenLastCalledWith(expect.stringContaining("s.status = 'active'"), [user.id]);
  });

  it('falls back to Free when subscription lookup fails without failing login', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [user] }).mockRejectedValueOnce(new Error('subscription unavailable'));
    const res = await request(app).post('/login').send({ email: user.email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ planName: 'Free', isFree: true });
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});
