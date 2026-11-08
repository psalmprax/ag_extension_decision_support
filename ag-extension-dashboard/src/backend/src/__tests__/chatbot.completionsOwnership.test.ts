/**
 * Conversation ownership tests — chat completions must not accept a foreign
 * conversation_id (IDOR). History context is only injected when the caller
 * owns the conversation: farmers match via their farmer record (or user id),
 * officers via officer_id, and regional managers within their region.
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
jest.mock('../services/aiProvider/aiProvider', () => ({
    AIRouter: {
        routeRequest: jest.fn().mockResolvedValue({ text: 'assistant reply', providerUsed: 'mock', modelUsed: 'mock' }),
    },
    AIProviderFactory: {
        getPrimaryProvider: jest.fn(),
        getFallbackProvider: jest.fn(),
    },
    AI_CASCADE_FALLBACK: [],
}));
jest.mock('../services/ragV2Service', () => ({
    RAGV2Service: {
        enhancedSearch: jest.fn().mockResolvedValue({ results: [], citations: [] }),
    },
}));
jest.mock('../services/vectorService', () => ({
    VectorService: {
        hybridSearch: jest.fn().mockResolvedValue([]),
    },
}));
jest.mock('../services/mcpAdapter', () => ({
    createMCPRouter: jest.fn(() => jest.requireActual<typeof import('express')>('express').Router()),
    mcpAdapter: {
        convertToMCPTools: jest.fn().mockReturnValue([]),
        callTool: jest.fn(),
    },
}));
jest.mock('../middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import app from '../app';
import { mockQuery } from './helpers/setupMocks';

const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const OFFICER_ID = 'off-1';
const FARMER_USER_ID = 'farmer-user-1';
const FARMER_RECORD_ID = 'farmer-record-1';
const OTHER_FARMER_RECORD_ID = 'farmer-record-999';

function tokenFor(userId: string, role: string, email = `${userId}@test.dev`): string {
    return jwt.sign(
        { userId, email, role },
        config.jwt.secret as string,
        { expiresIn: '1h' }
    );
}

/**
 * Mock the DB layer for POST /api/chatbot/completions issued by a farmer.
 * The ownership join in loadHistoryBlock filters on
 *   cv.farmer_id = $2 OR cv.officer_id = $2
 * so the mocked chat_messages query returns rows ONLY when the ownership
 * parameter matches the farmer's own record.
 */
function mockFarmerCompletionsDb(opts: { ownershipParam: string }) {
    mockQuery.mockImplementation((sql: string) => {
        if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });

        const ownsIt = opts.ownershipParam === FARMER_RECORD_ID || opts.ownershipParam === FARMER_USER_ID;
        switch (true) {
            case sql.includes('FROM farmers WHERE user_id'):
                return Promise.resolve({ rows: [{ id: FARMER_RECORD_ID }], rowCount: 1 });
            case sql.includes('FROM chat_conversations cv') && sql.includes('LEFT JOIN farmers'):
                return Promise.resolve({
                    rows: ownsIt
                        ? [{ farmer_id: FARMER_RECORD_ID, officer_id: OFFICER_ID, region: 'North' }]
                        : [],
                    rowCount: ownsIt ? 1 : 0,
                });
            case sql.includes('FROM chat_conversations cv') && sql.includes('cv.id = $1'):
                return Promise.resolve({ rows: ownsIt ? [{ id: CONVERSATION_ID }] : [], rowCount: ownsIt ? 1 : 0 });
            case sql.includes('FROM chat_messages m') && sql.includes('JOIN chat_conversations cv'):
                // $2 is the ownership param. Foreign conversations yield zero rows.
                return Promise.resolve({
                    rows: ownsIt
                        ? [{ role: 'user', content: 'my earlier question about maize' }]
                        : [],
                    rowCount: ownsIt ? 1 : 0,
                });
            case sql.includes('INSERT INTO chat_messages'):
                return Promise.resolve({ rows: [], rowCount: 1 });
            default:
                return Promise.resolve({ rows: [], rowCount: 0 });
        }
    });
}

describe('chat completions conversation ownership (IDOR)', () => {
    beforeEach(async () => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        // Clear AIRouter.routeRequest call history between tests so prompt
        // assertions read the current test's request, not a prior one's.
        const { AIRouter } = await import('../services/aiProvider/aiProvider');
        (AIRouter.routeRequest as jest.Mock).mockClear();
    });

    it('injects history for the owner (farmer, own conversation)', async () => {
        const token = tokenFor(FARMER_USER_ID, 'farmer');
        mockFarmerCompletionsDb({ ownershipParam: FARMER_RECORD_ID });

        const res = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'follow-up question', conversation_id: CONVERSATION_ID });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const routeCall = (await import('../services/aiProvider/aiProvider')).AIRouter
            .routeRequest as jest.Mock;
        expect(routeCall).toHaveBeenCalledWith('generate', expect.objectContaining({
            options: expect.objectContaining({ preferredProvider: 'aihubmix' }),
        }));

        // The history query must carry the farmer's own record id as $2.
        const historyCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('JOIN chat_conversations cv')
        );
        expect(historyCall).toBeDefined();
        expect(historyCall![0]).toContain('cv.farmer_id = $2 OR cv.officer_id = $2');
        expect(historyCall![1][1]).toBe(FARMER_RECORD_ID);
    });

    it('rejects a foreign conversation before writing or generating a completion', async () => {
        const token = tokenFor(FARMER_USER_ID, 'farmer');
        // The join's ownership param is the caller's OWN record; the foreign
        // conversation does not match it, so the mocked join yields zero rows.
        mockFarmerCompletionsDb({ ownershipParam: OTHER_FARMER_RECORD_ID });

        const res = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'sneaky read', conversation_id: FOREIGN_CONVERSATION_ID });

        expect(res.status).toBe(404);
        expect(mockQuery.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO chat_messages'))).toBe(false);
        const routeCall = (await import('../services/aiProvider/aiProvider')).AIRouter.routeRequest as jest.Mock;
        expect(routeCall).not.toHaveBeenCalled();
    });

    it('scopes officer access by officer_id, not by farmer record', async () => {
        const token = tokenFor(OFFICER_ID, 'extension_officer');
        mockQuery.mockImplementation((sql: string) => {
            if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });
            if (sql.includes('FROM chat_conversations cv') && sql.includes('LEFT JOIN farmers')) {
                return Promise.resolve({
                    rows: [{ farmer_id: FARMER_RECORD_ID, officer_id: OFFICER_ID, region: 'North' }],
                    rowCount: 1,
                });
            }
            if (sql.includes('FROM chat_conversations cv') && sql.includes('cv.id = $1')) {
                return Promise.resolve({ rows: [{ id: CONVERSATION_ID }], rowCount: 1 });
            }
            if (sql.includes('FROM chat_messages m') && sql.includes('JOIN chat_conversations cv')) {
                // Officer's own id as ownership param → sees their conversations.
                return Promise.resolve({
                    rows: [{ role: 'user', content: 'hello from my officer thread' }],
                    rowCount: 1,
                });
            }
            if (sql.includes('INSERT INTO chat_messages')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'check in', conversation_id: CONVERSATION_ID });

        expect(res.status).toBe(200);
        const historyCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('JOIN chat_conversations cv')
        );
        expect(historyCall).toBeDefined();
        expect(historyCall![1][1]).toBe(OFFICER_ID);
    });

    it('lets admins read across conversations (no ownership clause)', async () => {
        const token = tokenFor('admin-1', 'admin');
        mockQuery.mockImplementation((sql: string) => {
            if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });
            if (sql.includes('FROM chat_messages m') && sql.includes('JOIN chat_conversations cv')) {
                return Promise.resolve({
                    rows: [{ role: 'user', content: 'any conversation content' }],
                    rowCount: 1,
                });
            }
            if (sql.includes('INSERT INTO chat_messages')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'audit check', conversation_id: FOREIGN_CONVERSATION_ID });

        expect(res.status).toBe(200);
        const historyCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('JOIN chat_conversations cv')
        );
        expect(historyCall).toBeDefined();
        // Admins skip the ownership clause entirely (no $2 binding).
        expect(historyCall![0]).not.toContain('cv.farmer_id = $2');
    });

    it('rejects a regional manager outside the conversation farmer region', async () => {
        const token = tokenFor('manager-1', 'regional_manager');
        mockQuery.mockImplementation((sql: string) => {
            if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });
            if (sql.includes('FROM chat_conversations cv') && sql.includes('LEFT JOIN farmers')) {
                return Promise.resolve({
                    rows: [{ farmer_id: 'farmer-2', officer_id: OFFICER_ID, region: 'South' }],
                    rowCount: 1,
                });
            }
            if (sql.includes('SELECT region FROM users')) {
                return Promise.resolve({ rows: [{ region: 'North' }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'foreign conversation', conversation_id: CONVERSATION_ID });

        expect(res.status).toBe(404);
        const routeCall = (await import('../services/aiProvider/aiProvider')).AIRouter
            .routeRequest as jest.Mock;
        expect(routeCall).not.toHaveBeenCalled();
    });

    it('keeps demo accounts out of persistent conversations and completions', async () => {
        const token = tokenFor('demo-user', 'extension_officer', 'demo@agridemo.com');

        const completion = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'demo question' });
        const conversations = await request(app)
            .get('/api/chatbot/conversations')
            .set('Authorization', `Bearer ${token}`);

        expect(completion.status).toBe(403);
        expect(conversations.status).toBe(403);
        const routeCall = (await import('../services/aiProvider/aiProvider')).AIRouter
            .routeRequest as jest.Mock;
        expect(routeCall).not.toHaveBeenCalled();
    });
});
