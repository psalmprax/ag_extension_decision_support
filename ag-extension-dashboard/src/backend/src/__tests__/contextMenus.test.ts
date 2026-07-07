import request from 'supertest';
import app from '../app';
import { makeOfficerToken } from './helpers/setupMocks';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
    initializeDatabase: jest.fn(),
    getCache: jest.fn(() => null),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Admin-only endpoints — use admin role for the mock user
jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
        if (!req.headers?.authorization) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        req.user = { userId: 'admin-1', role: 'admin', email: 'admin@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ContextMenus Route — Mapper-before-response: mapApiClientRows + mapApiClientRow', () => {
    let adminToken: string;

    beforeAll(() => {
        adminToken = makeOfficerToken({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    });

    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('GET /clients returns camelCase ApiClientDTO[] from snake_case rows', async () => {
        const apiClientRow = {
            id: 'client-1',
            name: 'Mobile App',
            description: 'iOS + Android clients',
            permissions: ['read:fields', 'write:visits'],
            rate_limit_per_min: 60,
            is_active: true,
            last_used_at: '2024-12-15T10:00:00Z',
            created_by: 'admin-1',
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
            // apiKeyHash must NOT appear in the response (secret field)
            api_key_hash: 'should-be-omitted',
        };
        mockQuery.mockResolvedValueOnce({ rows: [apiClientRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/context-menus/clients')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        // snake_case → camelCase
        expect(first.id).toBe('client-1');
        expect(first.name).toBe('Mobile App');
        expect(first.permissions).toEqual(['read:fields', 'write:visits']);
        expect(first.rateLimitPerMin).toBe(60);
        expect(first.isActive).toBe(true);
        expect(first.lastUsedAt).toBe('2024-12-15T10:00:00Z');
        expect(first.createdBy).toBe('admin-1');
        // Must NOT leak snake_case
        expect(first.rate_limit_per_min).toBeUndefined();
        expect(first.is_active).toBeUndefined();
        expect(first.last_used_at).toBeUndefined();
        // Must NOT leak the secret api_key_hash
        expect(first.apiKeyHash).toBeUndefined();
        expect(first.api_key_hash).toBeUndefined();
    });

    it('POST /clients invokes mapApiClientRow on the INSERT ... RETURNING row', async () => {
        const insertedRow = {
            id: 'client-new',
            name: 'New Client',
            description: null,
            permissions: null,
            rate_limit_per_min: 1000,
            is_active: true,
            last_used_at: null,
            created_by: 'admin-1',
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/context-menus/clients')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'New Client' });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe('client-new');
        expect(response.body.data.name).toBe('New Client');
        expect(response.body.data.rateLimitPerMin).toBe(1000);
        expect(response.body.data.createdBy).toBe('admin-1');
        // Must NOT leak snake_case
        expect(response.body.data.rate_limit_per_min).toBeUndefined();
        expect(response.body.data.created_by).toBeUndefined();
    });
});
