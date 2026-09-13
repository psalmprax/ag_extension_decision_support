import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { optionalAuth } from '@/middleware/authorize';
import { revokeToken } from '@/services/sessionService';
import { query } from '@/services/databaseService';

jest.mock('@/services/databaseService', () => ({
  query: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockQuery = query as jest.Mock;

// Distinct token per test: sessionService caches validity for 30s per token hash.
let counter = 0;
const signToken = (role = 'extension_officer') => {
  counter += 1;
  return jwt.sign(
    { userId: `user-${counter}`, email: `user-${counter}@test.dev`, role },
    config.jwt.secret as string,
    { expiresIn: '1h' },
  );
};

describe('optionalAuth middleware — session revocation', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('attaches req.user when JWT is valid and session is active', async () => {
    const token = signToken();
    mockQuery.mockResolvedValueOnce({ rows: [{ is_revoked: false, expires_at: '2099-01-01T00:00:00Z' }] });
    req.headers = { authorization: `Bearer ${token}` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual({
      userId: expect.any(String),
      email: expect.stringContaining('@test.dev'),
      role: 'extension_officer',
    });
  });

  it('treats a session revoked in the DB as anonymous (no req.user, still next)', async () => {
    const token = signToken();
    mockQuery.mockResolvedValueOnce({ rows: [{ is_revoked: true, expires_at: '2099-01-01T00:00:00Z' }] });
    req.headers = { authorization: `Bearer ${token}` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('treats a locally revoked token as anonymous', async () => {
    const token = signToken();
    revokeToken(token); // in-process revocation (mirrors logout on this replica)
    req.headers = { authorization: `Bearer ${token}` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it('treats a session whose DB row expired as anonymous', async () => {
    const token = signToken();
    mockQuery.mockResolvedValueOnce({ rows: [{ is_revoked: false, expires_at: '2000-01-01T00:00:00Z' }] });
    req.headers = { authorization: `Bearer ${token}` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it('still attaches legacy/demo tokens with no session row (JWT-only fail-open)', async () => {
    const token = signToken();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no user_sessions row
    req.headers = { authorization: `Bearer ${token}` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
  });

  it('stays fail-open on DB outage: valid JWT still attaches user (availability trade-off)', async () => {
    const token = signToken();
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    req.headers = { authorization: `Bearer ${token}` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
  });

  it('does not attach user for a tampered/invalid signature', async () => {
    const token = signToken();
    req.headers = { authorization: `Bearer ${token}x` };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it('passes through without user when no Authorization header is present', async () => {
    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('passes through without user for non-Bearer authorization schemes', async () => {
    req.headers = { authorization: 'Basic dXNlcjpwYXNz' };

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
