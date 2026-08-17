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

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WhatsApp Route — Mapper-before-response: mapWhatsAppMessageRows + mapWhatsAppMessageRow + mapCountRows', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = makeOfficerToken();
    });

    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('GET /messages returns camelCase WhatsAppMessageDTO from snake_case row', async () => {
        const waRow = {
            id: 'wa-1',
            sender_id: 'off-1',
            recipient_phone: '+265999000111',
            farmer_id: 'farm-uuid-1',
            message: 'Hello from WhatsApp',
            direction: 'outbound',
            status: 'delivered',
            provider: 'meta_cloud',
            created_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [waRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/whatsapp/messages')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        // snake_case → camelCase
        expect(first.id).toBe('wa-1');
        expect(first.senderId).toBe('off-1');
        expect(first.recipientPhone).toBe('+265999000111');
        expect(first.farmerId).toBe('farm-uuid-1');
        expect(first.direction).toBe('outbound');
        expect(first.provider).toBe('meta_cloud');
        expect(first.createdAt).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case
        expect(first.sender_id).toBeUndefined();
        expect(first.recipient_phone).toBeUndefined();
        expect(first.created_at).toBeUndefined();
    });

    it('POST /send invokes mapWhatsAppMessageRow on the INSERT ... RETURNING row', async () => {
        const insertedRow = {
            id: 'wa-new',
            sender_id: 'off-1',
            recipient_phone: '+265999000222',
            farmer_id: null,
            message: 'Test message',
            direction: 'outbound',
            status: 'not_configured',
            provider: 'none',
            created_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/whatsapp/send')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ to: '+265999000222', message: 'Test message' });

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.status).toBe('not_configured');
        // The response is the mapped row from INSERT ... RETURNING
        expect(response.body.data.senderId).toBe('off-1');
        expect(response.body.data.recipientPhone).toBe('+265999000222');
        expect(response.body.data.direction).toBe('outbound');
        expect(response.body.data.status).toBe('not_configured');
        // Must NOT leak snake_case
        expect(response.body.data.sender_id).toBeUndefined();
        expect(response.body.data.recipient_phone).toBeUndefined();
    });

    it('GET /stats invokes mapCountRows on both COUNT queries (inbound + outbound)', async () => {
        // 1) inbound count
        mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 });
        // 2) outbound count
        mockQuery.mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/whatsapp/stats')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        // parseInt on COUNT string → number
        expect(response.body.data.inbound).toBe(42);
        expect(response.body.data.outbound).toBe(15);
        expect(typeof response.body.data.inbound).toBe('number');
        expect(typeof response.body.data.outbound).toBe('number');
    });
});
