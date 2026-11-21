import request from 'supertest';
import app from '../app';

/**
 * Routes whose SQL once named columns the schema does not have, or whose one-word
 * paths were swallowed by a `/:id` route mounted first. Mocked tests passed while the
 * real database answered 500, so these pin the SQL and the routing themselves.
 */

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn().mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 }) })),
    query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => null),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
    cacheDel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFarmerFindFirst = jest.fn().mockResolvedValue(null);
jest.mock('../services/prismaService', () => {
    // Every model answers "nothing found"; farmer.findFirst is recorded so a test can read its lookups.
    const model = () => new Proxy({}, { get: () => jest.fn().mockResolvedValue(null) });
    const client = new Proxy({}, {
        get: (_target, name) => (name === 'farmer'
            ? { findFirst: (...args: unknown[]) => mockFarmerFindFirst(...args), findUnique: jest.fn().mockResolvedValue(null) }
            : model()),
    });
    return { getPrisma: () => client, disconnectPrisma: jest.fn() };
});

let currentRole = 'extension_officer';
jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { userId: '11111111-2222-4333-8444-555555555555', role: currentRole, email: 'user@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

const sqlSent = (): string[] => mockQuery.mock.calls.map(call => String(call[0]));
const paramsSent = (): unknown[] => mockQuery.mock.calls.flatMap(call => (Array.isArray(call[1]) ? call[1] : []));

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('SQL names only columns the schema has', () => {
    it('farmer stats for an account with no tenant does not compare tenant_id with the word null', async () => {
        currentRole = 'admin';
        const response = await request(app).get('/api/v1/analytics/farmer-stats').set('Authorization', 'Bearer x');
        expect(response.status).toBe(200);
        expect(sqlSent().join('\n')).not.toMatch(/tenant_id = 'null'/);
    });

    it('portfolio risk reads alerts by affected_farmers and location, not a missing affected_regions column', async () => {
        currentRole = 'extension_officer';
        await request(app).get('/api/v1/portfolio').set('Authorization', 'Bearer x');
        const sql = sqlSent().join('\n');
        expect(sql).not.toMatch(/affected_regions/);
        expect(sql).toMatch(/affected_farmers/);
    });
});

describe('one-word paths are not read as ids', () => {
    it('GET /farmers/my-officer never looks up a farmer whose id is "my-officer"', async () => {
        currentRole = 'farmer';
        mockFarmerFindFirst.mockClear();
        const response = await request(app).get('/api/v1/farmers/my-officer').set('Authorization', 'Bearer x');
        expect(response.body.error).toBe('Farmer profile not found');
        const lookups = mockFarmerFindFirst.mock.calls.map(call => JSON.stringify(call[0]));
        expect(lookups.join(' ')).not.toContain('my-officer');
    });

    it('GET /knowledge/sources never looks up an article whose id is "sources"', async () => {
        currentRole = 'extension_officer';
        await request(app).get('/api/v1/knowledge/sources').set('Authorization', 'Bearer x');
        expect(paramsSent()).not.toContain('sources');
    });
});
