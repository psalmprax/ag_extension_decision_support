/**
 * Body-limit regression tests.
 *
 * The global pre-auth parsers are capped at 1MB; media-heavy API prefixes are
 * re-opened to 16MB. Guards both directions:
 *   - anonymous 1.5MB JSON on a normal route must be rejected (413)
 *   - the same payload on a media-heavy route must reach route logic (not 413)
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
import app from '../app';

// 1.5MB of JSON — over the 1MB global cap, under the 16MB media cap.
const bigPayload = { data: 'x'.repeat(1.5 * 1024 * 1024) };

describe('request body limits', () => {
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

    it('still parses large JSON on media-heavy routes (no 413)', async () => {
        const res = await request(app).post('/api/ai/speech').send(bigPayload);
        // Reaching route logic (auth/validation error) proves parsing succeeded.
        expect(res.status).not.toBe(413);
    });

    it('still parses large JSON on v1 media-heavy routes (no 413)', async () => {
        const res = await request(app).post('/api/v1/ai/speech').send(bigPayload);
        expect(res.status).not.toBe(413);
    });
});
