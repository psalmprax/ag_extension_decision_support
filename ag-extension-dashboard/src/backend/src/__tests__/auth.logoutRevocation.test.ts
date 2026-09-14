/**
 * Logout revocation tests.
 *
 * POST /auth/logout must revoke the presented session (DB row + shared
 * revocation list) so the token is dead immediately — not merely return 200
 * while the JWT stays valid until expiry. Covers both auth styles:
 *   - Authorization: Bearer header (mobile/extension/API clients)
 *   - httpOnly ag_token cookie (SPA) — cookies must be cleared on response
 */
process.env.NODE_ENV = 'test';

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => null),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));
jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => null),
}));
jest.mock('../services/sharedState', () => ({
    incrWindow: jest.fn().mockResolvedValue({ count: 1, resetAt: Date.now() + 60000 }),
    resetWindow: jest.fn(),
    getTtl: jest.fn().mockResolvedValue(null),
    setWithTtl: jest.fn(),
    setNx: jest.fn().mockResolvedValue(true),
    delKey: jest.fn(),
    addToSet: jest.fn().mockResolvedValue(undefined),
    inSet: jest.fn().mockResolvedValue(false),
    __resetSharedStateForTests: jest.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import app from '../app';
import { mockQuery } from './helpers/setupMocks';

// Row returned when the UPDATE ... WHERE token_hash = $1 matches a session.
const revokedRow = { token_hash: 'hash-of-presented-token' };

function makeToken(userId = 'user-logout-1'): string {
    return jwt.sign(
        { userId, email: `${userId}@test.dev`, role: 'extension_officer' },
        config.jwt.secret as string,
        { expiresIn: '1h' }
    );
}

describe('logout revocation', () => {
    // bcrypt compare is slow at cost 12; keep the suite under the default timeout.
    jest.setTimeout(30000);

    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('revokes the session row for a Bearer-token logout', async () => {
        const token = makeToken();
        // First query inside logout: UPDATE user_sessions ... RETURNING token_hash
        mockQuery.mockResolvedValueOnce({ rows: [revokedRow], rowCount: 1 });

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updateCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('UPDATE user_sessions')
        );
        expect(updateCall).toBeDefined();
        // The token is hashed before it ever reaches the query.
        expect(updateCall![1][0]).not.toBe(token);
        expect(updateCall![1][0]).toHaveLength(64);
    });

    it('revokes the session for a cookie logout and clears both auth cookies', async () => {
        const token = makeToken('user-logout-2');
        mockQuery.mockResolvedValueOnce({ rows: [revokedRow], rowCount: 1 });

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', [`ag_token=${token}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updateCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('UPDATE user_sessions')
        );
        expect(updateCall).toBeDefined();

        const setCookies = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie']].filter(Boolean);
        const expiryCookies = setCookies.map(String).filter((c) => /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c));
        expect(expiryCookies.some((c) => c.startsWith('ag_token='))).toBe(true);
        expect(expiryCookies.some((c) => c.startsWith('ag_csrf='))).toBe(true);
    });

    it('clears cookies even when no token is presented (idempotent logout)', async () => {
        const res = await request(app).post('/api/auth/logout');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const setCookies = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie']].filter(Boolean);
        const expiryCookies = setCookies.map(String).filter((c) => /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c));
        expect(expiryCookies.some((c) => c.startsWith('ag_token='))).toBe(true);
        // No revocation query should run without a token.
        expect(mockQuery.mock.calls.some((c) => typeof c[0] === 'string' && c[0].includes('UPDATE user_sessions'))).toBe(false);
    });

    it('still returns 200 (and clears cookies) when the token has no session row', async () => {
        const token = makeToken('user-logout-3');
        // UPDATE matches nothing → rowCount 0 (legacy/demo token)
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('issues the auth cookie pair on login', async () => {
        // Real hash of 'password' so bcrypt.compare succeeds.
        const passwordHash = await bcrypt.hash('password', 10);
        const token = makeToken('user-login-cookie');
        mockQuery.mockImplementation((sql: string) => {
            if (typeof sql === 'string' && sql.includes('FROM users WHERE email')) {
                return Promise.resolve({
                    rows: [{
                        id: 'user-login-cookie',
                        email: 'user-login-cookie@test.dev',
                        password_hash: passwordHash,
                        role: 'extension_officer',
                        mfa_enabled: false,
                        lockout_until: null,
                        is_demo: false,
                        email_verified: true,
                        region: 'Nairobi',
                    }],
                    rowCount: 1,
                });
            }
            if (typeof sql === 'string' && sql.includes('INSERT INTO user_sessions')) {
                return Promise.resolve({ rows: [{ id: 'session-1' }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        // Login is CSRF-exempt (no pre-auth session to forge against).
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user-login-cookie@test.dev', password: 'password' });

        expect(res.status).toBe(200);
        const setCookies = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [];
        const cookieStrings = setCookies.map(String);
        const authCookie = cookieStrings.find((c) => c.startsWith('ag_token='));
        const csrfCookie = cookieStrings.find((c) => c.startsWith('ag_csrf='));

        expect(authCookie).toBeDefined();
        expect(authCookie).toMatch(/HttpOnly/i);
        expect(authCookie).toMatch(/SameSite=Lax/i);

        // The cookie carries the server-issued session JWT (not our pre-made
        // one) — decode it and verify the identity claims.
        const cookieValue = authCookie!.split(';')[0].slice('ag_token='.length);
        const cookieClaims = jwt.decode(cookieValue) as { userId: string } | null;
        expect(cookieClaims?.userId).toBe('user-login-cookie');

        expect(csrfCookie).toBeDefined();
        // CSRF cookie is readable (SPA must echo it) and differs from the JWT.
        expect(csrfCookie).not.toMatch(/HttpOnly/i);
        const csrfValue = csrfCookie!.split(';')[0].slice('ag_csrf='.length);
        expect(csrfValue).not.toContain('eyJ'); // not a JWT
    });
});
