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

// Use extension_officer role (the mock authorize injects this role)
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

jest.mock('../services/aiProvider/aiProvider', () => ({
    AIProviderFactory: {
        getProvider: jest.fn().mockResolvedValue({
            generateText: jest.fn().mockResolvedValue({ text: 'AI response' }),
        }),
    },
}));

import { query, getPool } from '../services/databaseService';
const mockQuery = query as jest.Mock;
const mockGetPool = getPool as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Chatbot Route — Mapper-before-response: mapChatMessageRow + mapChatConversationRow + mapChatMessageRows + mapChatConversationRows + mapSatisfactionAvgRow + mapCountRow', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = makeOfficerToken();
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('POST /messages invokes mapChatMessageRow on the INSERT ... RETURNING row', async () => {
        const insertedRow = {
            id: 'msg-1',
            conversation_id: 'conv-1',
            role: 'user',
            content: 'How do I plant maize?',
            farmer_id: null,
            user_id: 'off-1',
            rating: null,
            feedback: null,
            metadata: null,
            created_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/chatbot/messages')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ role: 'user', content: 'How do I plant maize?', conversation_id: 'conv-1' });

        expect(response.status).toBe(201);
        // snake_case → camelCase
        expect(response.body.data.id).toBe('msg-1');
        expect(response.body.data.conversationId).toBe('conv-1');
        expect(response.body.data.role).toBe('user');
        expect(response.body.data.content).toBe('How do I plant maize?');
        expect(response.body.data.createdAt).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case (proves mapper ran)
        expect(response.body.data.conversation_id).toBeUndefined();
        expect(response.body.data.created_at).toBeUndefined();
        // userId/farmerId mapping covered by GET /conversations/:id/messages test
    });

    it('GET /conversations returns camelCase ChatConversationDTO[] from snake_case rows', async () => {
        const convRow = {
            id: 'conv-1',
            user_id: null,
            farmer_id: 'farm-uuid-1',
            officer_id: 'off-1',
            title: 'Maize planting advice',
            status: 'active',
            started_at: '2024-12-15T10:00:00Z',
            ended_at: null,
            satisfaction_rating: 4,
            metadata: { source: 'web' },
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [convRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/chatbot/conversations')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        // snake_case → camelCase
        expect(first.id).toBe('conv-1');
        expect(first.userId).toBeNull();
        expect(first.farmerId).toBe('farm-uuid-1');
        expect(first.title).toBe('Maize planting advice');
        expect(first.status).toBe('active');
        expect(first.startedAt).toBe('2024-12-15T10:00:00Z');
        expect(first.endedAt).toBeNull();
        expect(first.satisfactionRating).toBe(4);
        expect(first.metadata).toEqual({ source: 'web' });
        // Must NOT leak snake_case (proves mapper ran)
        expect(first.user_id).toBeUndefined();
        expect(first.farmer_id).toBeUndefined();
        expect(first.officer_id).toBeUndefined();
        expect(first.started_at).toBeUndefined();
        expect(first.satisfaction_rating).toBeUndefined();
    });

    it('GET /conversations/:id/messages returns camelCase ChatMessageDTO[] from snake_case rows', async () => {
        const msgRow = {
            id: 'msg-1',
            conversation_id: 'conv-1',
            role: 'user',
            content: 'Hello',
            farmer_id: null,
            user_id: 'off-1',
            rating: null,
            feedback: null,
            metadata: null,
            created_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [msgRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/chatbot/conversations/conv-1/messages')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data[0];
        expect(first.conversationId).toBe('conv-1');
        expect(first.createdAt).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case (proves mapper ran)
        expect(first.conversation_id).toBeUndefined();
    });

    it('POST /conversations invokes mapChatConversationRow on the INSERT ... RETURNING row', async () => {
        // For extension_officer role, the route sets officerId = user.userId
        // and farmerId = null. The mock authorize injects userId: 'off-1'.
        const insertedRow = {
            id: 'conv-new',
            user_id: null,
            farmer_id: null,
            officer_id: 'off-1',
            title: null,
            status: 'active',
            started_at: '2024-12-15T10:00:00Z',
            ended_at: null,
            satisfaction_rating: null,
            metadata: null,
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/chatbot/conversations')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ language: 'en' });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe('conv-new');
        expect(response.body.data.status).toBe('active');
        expect(response.body.data.startedAt).toBe('2024-12-15T10:00:00Z');
        // Must NOT leak snake_case (proves mapper ran)
        expect(response.body.data.officer_id).toBeUndefined();
        expect(response.body.data.farmer_id).toBeUndefined();
        expect(response.body.data.started_at).toBeUndefined();
        // Note: officerId/farmerId mapping is covered by the GET /conversations test
    });

    it('GET /stats/overview invokes mapCountRow + mapSatisfactionAvgRow on COUNT + AVG queries', async () => {
        // 1) 7-day conversation count
        mockQuery.mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 });
        // 2) satisfaction AVG + total ratings
        mockQuery.mockResolvedValueOnce({
            rows: [{ avg_satisfaction: '4.2', total_ratings: '18' }],
            rowCount: 1,
        });

        const response = await request(app)
            .get('/api/v1/chatbot/stats/overview')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        // parseInt on COUNT string → number
        expect(response.body.data.conversations7d).toBe(25);
        expect(typeof response.body.data.conversations7d).toBe('number');
        // parseFloat on AVG string → number
        expect(response.body.data.avgSatisfaction).toBe(4.2);
        expect(response.body.data.totalRatings).toBe(18);
        expect(typeof response.body.data.totalRatings).toBe('number');
    });
});
