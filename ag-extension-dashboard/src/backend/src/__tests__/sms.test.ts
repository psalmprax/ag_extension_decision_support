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
    initializeCache: jest.fn(),
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

// SMS service is a heavy dependency — mock it so the route handlers don't try
// to actually send messages or call the AI provider.
jest.mock('../services/smsService', () => ({
    smsService: {
        sendSMS: jest.fn().mockResolvedValue(true),
        sendBulkSMS: jest.fn().mockResolvedValue({ sent: 1, failed: 0, results: [] }),
        startUSSDSession: jest.fn().mockResolvedValue({ response: 'CON Welcome' }),
        handleUSSDInput: jest.fn().mockResolvedValue({ response: 'CON Choose' }),
        scheduleSMS: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../services/usageService', () => ({
    usageService: {
        incrementUsage: jest.fn().mockResolvedValue(undefined),
        incrementUsageBy: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../middleware/validate', () => ({
    validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../services/aiProvider/aiProvider', () => ({
    AIProviderFactory: {
        getProvider: jest.fn().mockResolvedValue({
            generateText: jest.fn().mockResolvedValue({ text: 'translated text' }),
        }),
    },
}));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SMS Route — Mapper-before-response: mapSmsHistoryRows', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = makeOfficerToken();
    });

    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('GET /history returns camelCase SmsHistoryDTO from snake_case row', async () => {
        // Raw snake_case row from pg (id, sender_id, recipient_phone, etc.)
        const smsRow = {
            id: 'sms-1',
            sender_id: 'off-1',
            recipient_phone: '+265999000111',
            farmer_id: 'farm-uuid-1',
            message: 'Your maize is ready for harvest',
            status: 'delivered',
            provider: 'twilio',
            created_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [smsRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/sms/history')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const first = response.body.data[0];
        // snake_case → camelCase mapping in mapSmsHistoryRow
        expect(first.id).toBe('sms-1');
        expect(first.senderId).toBe('off-1');
        expect(first.recipientPhone).toBe('+265999000111');
        expect(first.farmerId).toBe('farm-uuid-1');
        expect(first.message).toBe('Your maize is ready for harvest');
        expect(first.status).toBe('delivered');
        expect(first.provider).toBe('twilio');
        expect(first.createdAt).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case
        expect(first.sender_id).toBeUndefined();
        expect(first.recipient_phone).toBeUndefined();
        expect(first.farmer_id).toBeUndefined();
        expect(first.created_at).toBeUndefined();
    });

    it('GET /history?farmerId=X passes the farmerId as a query parameter', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        await request(app)
            .get('/api/v1/sms/history?farmerId=farm-uuid-1')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        // The SQL should include the farmer_id filter. Role scoping param
        // (officer userId) is injected first, then farmerId.
        const call = mockQuery.mock.calls[0];
        const sql = call[0] as string;
        const params = call[1] as unknown[];
        expect(sql).toContain('farmer_id');
        expect(params[1]).toBe('farm-uuid-1');
    });
});
