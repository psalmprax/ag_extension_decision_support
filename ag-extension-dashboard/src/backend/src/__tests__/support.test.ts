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

jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
        if (!req.headers?.authorization) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        req.user = { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

import { query, getPool } from '../services/databaseService';
const mockQuery = query as jest.Mock;
const mockGetPool = getPool as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Support Route — Mapper-before-response: mapSupportTicketRows + mapSupportTicketRow + mapCountRow', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = makeOfficerToken();
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('GET /tickets returns camelCase SupportTicketDTO[] from snake_case rows', async () => {
        const ticketRow = {
            id: 'ticket-1',
            created_by: 'off-1',
            subject: 'GPS not working',
            status: 'open',
            priority: 'high',
            category: 'technical',
            description: 'GPS logs no coordinates',
            assigned_to: null,
            resolved_at: null,
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [ticketRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/support/tickets')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        // snake_case → camelCase
        expect(first.id).toBe('ticket-1');
        expect(first.userId).toBe('off-1');
        expect(first.subject).toBe('GPS not working');
        expect(first.status).toBe('open');
        expect(first.priority).toBe('high');
        expect(first.category).toBe('technical');
        expect(first.assignedTo).toBeNull();
        expect(first.resolvedAt).toBeNull();
        expect(first.createdAt).toBe('2024-12-15T10:00:00Z');
        expect(first.updatedAt).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case
        expect(first.created_by).toBeUndefined();
        expect(first.assigned_to).toBeUndefined();
        expect(first.resolved_at).toBeUndefined();
        expect(first.created_at).toBeUndefined();
    });

    it('POST /tickets invokes mapSupportTicketRow on the INSERT ... RETURNING row', async () => {
        const insertedRow = {
            id: 'ticket-new',
            created_by: 'off-1',
            subject: 'New issue',
            status: 'open',
            priority: 'normal',
            category: 'feature-request',
            description: 'Something is broken',
            assigned_to: null,
            resolved_at: null,
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/support/tickets')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ subject: 'New issue', description: 'Something is broken', category: 'feature-request' });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe('ticket-new');
        expect(response.body.data.userId).toBe('off-1');
        expect(response.body.data.status).toBe('open');
        expect(response.body.data.category).toBe('feature-request');
        expect(response.body.data.created_by).toBeUndefined();
    });

    it('rejects unknown ticket categories without writing to the database', async () => {
        const response = await request(app)
            .post('/api/v1/support/tickets')
            .set('Authorization', 'Bearer ' + officerToken)
            .send({ subject: 'New issue', description: 'Something is broken', category: 'unknown-category' });

        expect(response.status).toBe(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('POST /tickets stores the author in created_by', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 't', created_by: 'off-1', status: 'open' }], rowCount: 1 });
        await request(app)
            .post('/api/v1/support/tickets')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ subject: 'New issue', description: 'Something is broken', category: 'technical' });
        expect(String(mockQuery.mock.calls[0][0])).toMatch(/created_by/);
        expect(String(mockQuery.mock.calls[0][0])).not.toMatch(/\buser_id\b/);
    });
});

describe('Support Route — PATCH /tickets/:id only changes known columns', () => {
    const patch = (body: Record<string, unknown>) =>
        request(app).patch('/api/v1/support/tickets/5d1c8a3e-2b4f-4c6d-9e8a-7f0b1c2d3e4f').set('Authorization', `Bearer ${makeOfficerToken()}`).send(body);

    beforeEach(() => mockQuery.mockReset());

    it('ignores body keys that are not ticket fields, so none reach the SQL', async () => {
        const response = await patch({ subject: 'changed', created_by: 'someone-else' });
        expect(response.status).toBe(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects a status or priority outside the allowed lists', async () => {
        expect((await patch({ status: 'deleted' })).status).toBe(400);
        expect((await patch({ priority: 'whenever' })).status).toBe(400);
        expect((await patch({ assigned_to: 'not-a-uuid' })).status).toBe(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('updates with placeholders and stamps resolved_at when the ticket is resolved', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ticket-1', created_by: 'off-1', status: 'resolved' }], rowCount: 1 });
        const response = await patch({ status: 'resolved', assigned_to: null });
        expect(response.status).toBe(200);
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toMatch(/status = \$1, assigned_to = \$2, resolved_at = NOW\(\)/);
        expect(params).toEqual(['resolved', null, '5d1c8a3e-2b4f-4c6d-9e8a-7f0b1c2d3e4f']);
    });
});
