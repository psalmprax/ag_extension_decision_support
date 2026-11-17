/**
 * Farmer threads and officers' private AI chats are kept apart; officer
 * messages in a farmer thread never trigger an automatic AI reply; the
 * sender role always comes from the signed-in user.
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


const THREAD_ID = '55555555-5555-4555-8555-555555555555';
const OFFICER_ID = 'off-1';
const FARMER_USER_ID = 'farmer-user-1';
const FARMER_RECORD_ID = 'farmer-record-1';

function tokenFor(userId: string, role: string): string {
    return jwt.sign({ userId, email: `${userId}@test.dev`, role }, config.jwt.secret as string, { expiresIn: '1h' });
}

const sqlCalls = () => mockQuery.mock.calls.filter(c => typeof c[0] === 'string') as Array<[string, unknown[]]>;
const inserts = () => sqlCalls().filter(([sql]) => sql.includes('INSERT INTO chat_messages'));

/** A conversation of the given kind owned by OFFICER_ID about FARMER_RECORD_ID. */
function conversationOfKind(kind: 'farmer_thread' | 'officer_ai') {
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });
        if (sql.includes('FROM farmers WHERE user_id') || sql.includes('FROM farmers f WHERE f.user_id')) {
            return Promise.resolve({ rows: [{ id: FARMER_RECORD_ID }], rowCount: 1 });
        }
        if (sql.includes('SELECT cv.farmer_id, cv.officer_id, cv.kind')) {
            return Promise.resolve({
                rows: [{ farmer_id: FARMER_RECORD_ID, officer_id: OFFICER_ID, region: 'North', is_demo: false, kind }],
                rowCount: 1,
            });
        }
        if (sql.includes('SELECT farmer_id FROM chat_conversations')) {
            return Promise.resolve({ rows: [{ farmer_id: FARMER_RECORD_ID }], rowCount: 1 });
        }
        if (sql.includes('INSERT INTO chat_messages')) {
            return Promise.resolve({
                rows: [{ id: 'm1', conversation_id: params?.[0], role: params?.[1], content: params?.[2], created_at: new Date() }],
                rowCount: 1,
            });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
    });
}

describe('farmer threads vs officers\' private AI chats', () => {
    beforeEach(async () => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        const { AIRouter } = await import('../services/aiProvider/aiProvider');
        (AIRouter.routeRequest as jest.Mock).mockClear();
    });

    describe('POST /chatbot/completions', () => {
        it('refuses an officer sending into a farmer thread, so no AI reply reaches the farmer', async () => {
            conversationOfKind('farmer_thread');
            const res = await request(app)
                .post('/api/chatbot/completions')
                .set('Authorization', `Bearer ${tokenFor(OFFICER_ID, 'extension_officer')}`)
                .send({ message: 'How many acres did you plant?', conversation_id: THREAD_ID });

            expect(res.status).toBe(409);
            expect(inserts()).toHaveLength(0);
            const { AIRouter } = await import('../services/aiProvider/aiProvider');
            expect(AIRouter.routeRequest).not.toHaveBeenCalled();
        });

        it("stores both turns of an officer's private AI chat", async () => {
            conversationOfKind('officer_ai');
            const res = await request(app)
                .post('/api/chatbot/completions')
                .set('Authorization', `Bearer ${tokenFor(OFFICER_ID, 'extension_officer')}`)
                .send({ message: 'What causes maize streak?', conversation_id: THREAD_ID });

            expect(res.status).toBe(200);
            expect(inserts().map(([, params]) => params[1])).toEqual(['officer', 'assistant']);
        });

        it("hides an officer's private AI chat from the farmer it is about", async () => {
            conversationOfKind('officer_ai');
            const res = await request(app)
                .post('/api/chatbot/completions')
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`)
                .send({ message: 'hello', conversation_id: THREAD_ID });

            expect(res.status).toBe(404);
            expect(inserts()).toHaveLength(0);
        });

        it('keeps drafts for officers', async () => {
            conversationOfKind('farmer_thread');
            const res = await request(app)
                .post('/api/chatbot/completions')
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`)
                .send({ message: 'hello', conversation_id: THREAD_ID, mode: 'draft' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /chatbot/messages', () => {
        it.each([
            ['farmer', FARMER_USER_ID, 'user'],
            ['extension_officer', OFFICER_ID, 'officer'],
        ])('stores a %s message under their own role, whatever role the client claims', async (role, userId, stored) => {
            conversationOfKind('farmer_thread');
            const res = await request(app)
                .post('/api/chatbot/messages')
                .set('Authorization', `Bearer ${tokenFor(userId, role)}`)
                .send({ conversation_id: THREAD_ID, content: 'Apply lime at planting', role: 'assistant' });

            expect(res.status).toBe(201);
            expect(inserts()).toHaveLength(1);
            expect(inserts()[0][1][1]).toBe(stored);
        });
    });

    describe('GET /chatbot/conversations', () => {
        it('gives farmers no private AI chats, even when asked', async () => {
            const res = await request(app)
                .get('/api/chatbot/conversations?kind=officer_ai')
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
            expect(sqlCalls().some(([sql]) => sql.includes('FROM chat_conversations cv'))).toBe(false);
        });

        it("lists only the caller's own private AI chats", async () => {
            await request(app)
                .get('/api/chatbot/conversations?kind=officer_ai')
                .set('Authorization', `Bearer ${tokenFor('admin-1', 'admin')}`);

            const [sql, params] = sqlCalls().find(([q]) => q.includes('FROM chat_conversations cv'))!;
            expect(sql).toContain('cv.officer_id = $1');
            expect(sql).toContain('cv.kind = $2');
            expect(params.slice(0, 2)).toEqual(['admin-1', 'officer_ai']);
        });

        it('lists farmer threads by default', async () => {
            await request(app)
                .get('/api/chatbot/conversations')
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`);

            const [sql, params] = sqlCalls().find(([q]) => q.includes('FROM chat_conversations cv'))!;
            expect(sql).toContain('cv.kind = $2');
            expect(params[1]).toBe('farmer_thread');
        });
    });
});
