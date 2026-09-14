/**
 * Conversation ownership tests — chat completions must not accept a foreign
 * conversation_id (IDOR). History context is only injected when the caller
 * owns the conversation: farmers match via their farmer record (or user id),
 * officers via officer_id. Admin/regional managers may read across.
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

function tokenFor(userId: string, role: string): string {
    return jwt.sign(
        { userId, email: `${userId}@test.dev`, role },
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

        if (sql.includes('FROM farmers WHERE user_id')) {
            return Promise.resolve({ rows: [{ id: FARMER_RECORD_ID }], rowCount: 1 });
        }
        if (sql.includes('FROM chat_messages m') && sql.includes('JOIN chat_conversations cv')) {
            // $2 is the ownership param. Foreign conversations yield zero rows.
            const ownsIt = opts.ownershipParam === FARMER_RECORD_ID || opts.ownershipParam === FARMER_USER_ID;
            return Promise.resolve({
                rows: ownsIt
                    ? [{ role: 'user', content: 'my earlier question about maize' }]
                    : [],
                rowCount: ownsIt ? 1 : 0,
            });
        }
        if (sql.includes('INSERT INTO chat_messages')) {
            return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
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

        // The history query must carry the farmer's own record id as $2.
        const historyCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('JOIN chat_conversations cv')
        );
        expect(historyCall).toBeDefined();
        expect(historyCall![0]).toContain('cv.farmer_id = $2 OR cv.officer_id = $2');
        expect(historyCall![1][1]).toBe(FARMER_RECORD_ID);
    });

    it('denies history for a foreign conversation (farmer, other id → zero rows)', async () => {
        const token = tokenFor(FARMER_USER_ID, 'farmer');
        // The join's ownership param is the caller's OWN record; the foreign
        // conversation does not match it, so the mocked join yields zero rows.
        mockFarmerCompletionsDb({ ownershipParam: OTHER_FARMER_RECORD_ID });

        const res = await request(app)
            .post('/api/chatbot/completions')
            .set('Authorization', `Bearer ${token}`)
            .send({ message: 'sneaky read', conversation_id: FOREIGN_CONVERSATION_ID });

        expect(res.status).toBe(200);

        const historyCall = mockQuery.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('JOIN chat_conversations cv')
        );
        expect(historyCall).toBeDefined();
        // The ownership parameter is the CALLER's identity — never the
        // attacker-chosen conversation id.
        expect(historyCall![1][1]).toBe(FARMER_RECORD_ID);
        expect(historyCall![1][1]).not.toBe(FOREIGN_CONVERSATION_ID);

        // And the system prompt must NOT contain the foreign conversation text.
        const routeCall = (await import('../services/aiProvider/aiProvider')).AIRouter
            .routeRequest as jest.Mock;
        const promptArg = routeCall.mock.calls[0][1]?.prompt;
        const systemMessage = Array.isArray(promptArg) ? promptArg.find((m: { role: string }) => m.role === 'system') : null;
        expect(systemMessage?.content).not.toContain('RECENT CONVERSATION');
    });

    it('scopes officer access by officer_id, not by farmer record', async () => {
        const token = tokenFor(OFFICER_ID, 'extension_officer');
        mockQuery.mockImplementation((sql: string) => {
            if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });
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
});
