/**
 * Body-limit regression tests.
 *
 * The global pre-auth parsers are capped at 1MB; media-heavy API prefixes are
 * re-opened to 16MB **for authenticated requests** (and for signature-verified
 * webhook endpoints). Anonymous clients are capped at 1MB everywhere — a 16MB
 * pre-auth parser is a DoS amplification surface. Guards all three directions:
 *   - anonymous 1.5MB JSON on a normal route must be rejected (413)
 *   - the same payload from an anonymous client on a media route → 413
 *   - an authenticated client on a media route reaches route logic (not 413)
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

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import app from '../app';
import { csrfTokenFor } from '../middleware/authCookie';

// 1.5MB of JSON — over the 1MB global cap, under the 16MB media cap.
const bigPayload = { data: 'x'.repeat(1.5 * 1024 * 1024) };

// optionalAuth verifies the signature and the (mocked) session store; a signed
// token without a session row is treated as a valid legacy session.
const officerToken = jwt.sign(
    { userId: '11111111-1111-1111-1111-111111111111', email: 'officer@test.dev', role: 'extension_officer' },
    config.jwt.secret as string,
    { expiresIn: '1h' }
);
const authHeader = { Authorization: `Bearer ${officerToken}` };

describe('request body limits', () => {
    it.each(['/api/ai/speech', '/api/v1/ai/speech'])('allows the same large payload for cookie and bearer authentication at %s', async path => {
        const csrf = csrfTokenFor(officerToken);
        const bearer = await request(app).post(path).set(authHeader).send(bigPayload);
        const cookie = await request(app).post(path)
            .set('Cookie', [`ag_token=${officerToken}`, `ag_csrf=${csrf}`])
            .set('x-csrf-token', csrf).send(bigPayload);
        expect(cookie.status).not.toBe(413);
        expect(cookie.status).toBe(bearer.status);
    });

    it('does not grant the large-body allowance to invalid cookies', async () => {
        const response = await request(app).post('/api/ai/speech').set('Cookie', 'ag_token=invalid').send(bigPayload);
        expect(response.status).toBe(413);
    });

    it('rejects oversized JSON on regular routes (413)', async () => {
        const res = await request(app).post('/api/auth/login').send(bigPayload);
        expect(res.status).toBe(413);
    });

    it('rejects oversized urlencoded bodies on regular routes (413)', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .type('form')
            .send(`data=${'x'.repeat(1.5 * 1024 * 1024)}`);
        expect(res.status).toBe(413);
    });

    it('rejects oversized JSON from ANONYMOUS clients on media-heavy routes (413)', async () => {
        // The 16MB allowance is auth-gated; anonymous upload spam is capped.
        const res = await request(app).post('/api/ai/speech').send(bigPayload);
        expect(res.status).toBe(413);
    });

    it('rejects oversized JSON from ANONYMOUS clients on v1 media-heavy routes (413)', async () => {
        const res = await request(app).post('/api/v1/ai/speech').send(bigPayload);
        expect(res.status).toBe(413);
    });

    it('still parses large JSON for authenticated clients on media-heavy routes (no 413)', async () => {
        const res = await request(app).post('/api/ai/speech').set(authHeader).send(bigPayload);
        // Reaching route logic (auth/validation error) proves parsing succeeded.
        expect(res.status).not.toBe(413);
    });

    it('still parses large JSON for authenticated clients on v1 media-heavy routes (no 413)', async () => {
        const res = await request(app).post('/api/v1/ai/speech').set(authHeader).send(bigPayload);
        expect(res.status).not.toBe(413);
    });
});
