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

// Admin-only endpoints
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

jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('$2a$10$hashedpassword'),
}));

import { query, getPool } from '../services/databaseService';
const mockQuery = query as jest.Mock;
const mockGetPool = getPool as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Users Route — Mapper-before-response: mapUserPublicRows + mapUserPublicRow + mapUserRows', () => {
    let adminToken: string;

    beforeAll(() => {
        adminToken = makeOfficerToken({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('GET / returns camelCase UserPublicDTO[] from snake_case rows', async () => {
        const userRow = {
            id: 'user-1',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Banda',
            role: 'extension_officer',
            region: 'Central',
            phone: '+265999000111',
            is_active: true,
            preferred_language: 'en',
            avatar_url: 'https://example.com/avatar.jpg',
            last_login: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        // snake_case → camelCase
        expect(first.id).toBe('user-1');
        expect(first.email).toBe('jane@example.com');
        expect(first.firstName).toBe('Jane');
        expect(first.lastName).toBe('Banda');
        expect(first.role).toBe('extension_officer');
        expect(first.region).toBe('Central');
        expect(first.phone).toBe('+265999000111');
        expect(first.isActive).toBe(true);
        expect(first.preferredLanguage).toBe('en');
        expect(first.avatarUrl).toBe('https://example.com/avatar.jpg');
        expect(first.lastLogin).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case
        expect(first.first_name).toBeUndefined();
        expect(first.last_name).toBeUndefined();
        expect(first.is_active).toBeUndefined();
        expect(first.preferred_language).toBeUndefined();
        expect(first.avatar_url).toBeUndefined();
        expect(first.last_login).toBeUndefined();
    });

    it('GET /:id returns camelCase UserPublicDTO from snake_case row', async () => {
        const userRow = {
            id: 'user-1',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Banda',
            role: 'extension_officer',
            region: 'Central',
            phone: null,
            is_active: true,
            preferred_language: 'ny',
            avatar_url: null,
            last_login: null,
        };
        mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/users/user-1')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.firstName).toBe('Jane');
        expect(response.body.data.preferredLanguage).toBe('ny');
        expect(response.body.data.lastLogin).toBeNull();
        expect(response.body.data.first_name).toBeUndefined();
    });

    it('POST / invokes mapUserPublicRow on the INSERT ... RETURNING row', async () => {
        const insertedRow = {
            id: 'user-new',
            email: 'new@example.com',
            first_name: 'New',
            last_name: 'User',
            role: 'farmer',
            region: null,
            phone: null,
            is_active: true,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'new@example.com', password: 'secret123', first_name: 'New', last_name: 'User' });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe('user-new');
        expect(response.body.data.firstName).toBe('New');
        expect(response.body.data.isActive).toBe(true);
        // Must NOT leak snake_case
        expect(response.body.data.first_name).toBeUndefined();
        expect(response.body.data.is_active).toBeUndefined();
    });

    it('POST / accepts camelCase firstName, lastName, and country', async () => {
        const insertedRow = {
            id: 'user-camel',
            email: 'camel@example.com',
            first_name: 'Kiprono',
            last_name: 'Rotich',
            role: 'extension_officer',
            region: 'Rift Valley',
            country: 'Kenya',
            phone: '+254712345678',
            is_active: true,
            preferred_language: null,
            avatar_url: null,
            last_login: null,
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                email: 'camel@example.com',
                password: 'password123',
                firstName: 'Kiprono',
                lastName: 'Rotich',
                country: 'Kenya',
                region: 'Rift Valley',
                phone: '+254712345678',
            });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe('user-camel');
        expect(response.body.data.firstName).toBe('Kiprono');
        expect(response.body.data.lastName).toBe('Rotich');
        expect(response.body.data.country).toBe('Kenya');
        expect(response.body.data.first_name).toBeUndefined();
    });

    it('GET /role/:role invokes mapUserRows (full DTO with timestamps)', async () => {
        const userRow = {
            id: 'user-1',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Banda',
            role: 'extension_officer',
            region: 'Central',
            phone: null,
            is_active: true,
            last_login: '2024-12-15T10:00:00Z',
            avatar_url: null,
            preferred_language: 'en',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/users/role/extension_officer')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        // mapUserRow has more fields than mapUserPublicRow (createdAt, updatedAt)
        expect(first.firstName).toBe('Jane');
        expect(first.createdAt).toBe('2024-01-01T00:00:00Z');
        expect(first.updatedAt).toBe('2024-12-15T10:00:00Z');
        expect(first.first_name).toBeUndefined();
        expect(first.created_at).toBeUndefined();
    });
});
