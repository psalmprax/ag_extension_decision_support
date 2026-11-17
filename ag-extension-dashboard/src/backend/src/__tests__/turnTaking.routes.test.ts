/** Turn-taking between officers and the AI: Ask AI, the organisation's rules, urgent messages. */
process.env.NODE_ENV = 'test';

jest.mock('@/services/chat/threadAutoReply', () => ({
    loadThreadForReply: jest.fn(),
    answerFarmerInThread: jest.fn().mockResolvedValue(undefined),
    respondIfUrgent: jest.fn().mockResolvedValue(undefined),
}));
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


import { answerFarmerInThread, loadThreadForReply, respondIfUrgent } from '../services/chat/threadAutoReply';

const THREAD_ID = '66666666-6666-4666-8666-666666666666';
const TENANT_ID = '77777777-7777-4777-8777-777777777777';
const FARMER_USER_ID = 'farmer-user-1';
const FARMER_RECORD_ID = 'farmer-record-1';

function tokenFor(userId: string, role: string): string {
    return jwt.sign({ userId, email: `${userId}@test.dev`, role }, config.jwt.secret as string, { expiresIn: '1h' });
}

const sqlCalls = () => mockQuery.mock.calls.filter(c => typeof c[0] === 'string') as Array<[string, unknown[]]>;

function db(capabilities: unknown = null) {
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (typeof sql !== 'string') return Promise.resolve({ rows: [], rowCount: 0 });
        if (sql.includes('FROM farmers WHERE user_id')) return Promise.resolve({ rows: [{ id: FARMER_RECORD_ID }], rowCount: 1 });
        if (sql.includes('SELECT cv.farmer_id, cv.officer_id, cv.kind')) {
            return Promise.resolve({ rows: [{ farmer_id: FARMER_RECORD_ID, officer_id: 'off-1', region: 'North', is_demo: false, kind: 'farmer_thread' }], rowCount: 1 });
        }
        if (sql.includes('SELECT farmer_id FROM chat_conversations')) return Promise.resolve({ rows: [{ farmer_id: FARMER_RECORD_ID }], rowCount: 1 });
        if (sql.includes('COALESCE(u.tenant_id, f.tenant_id)')) return Promise.resolve({ rows: [{ tenant_id: TENANT_ID }], rowCount: 1 });
        if (sql.includes('SELECT capabilities FROM tenants')) return Promise.resolve({ rows: [{ capabilities }], rowCount: 1 });
        if (sql.includes('UPDATE tenants')) {
            return Promise.resolve({ rows: [{ capabilities: { chatTurnTaking: JSON.parse(String(params?.[1])) } }], rowCount: 1 });
        }
        if (sql.includes('INSERT INTO chat_messages')) {
            return Promise.resolve({ rows: [{ id: 'm1', conversation_id: params?.[0], role: params?.[1], content: params?.[2], created_at: new Date() }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
    });
}

const thread = (overrides: Record<string, unknown> = {}) => ({
    conversationId: THREAD_ID, farmerId: FARMER_RECORD_ID, farmerName: 'Amina', farmerUserId: FARMER_USER_ID, officerId: 'off-1',
    settings: {}, question: { content: 'Yellow leaves', language: 'en', at: new Date() },
    state: { lastFarmerMessageAt: new Date(), lastOfficerMessageAt: null, answeredSinceFarmer: false },
    aiAnsweredSinceFarmer: false,
    ...overrides,
});

describe('farmer and AI taking turns', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        db();
        jest.mocked(answerFarmerInThread).mockClear();
        jest.mocked(respondIfUrgent).mockClear();
    });

    describe('POST /chatbot/conversations/:id/ask-ai', () => {
        it("answers the farmer's latest message now", async () => {
            jest.mocked(loadThreadForReply).mockResolvedValueOnce(thread() as never);
            const res = await request(app)
                .post(`/api/chatbot/conversations/${THREAD_ID}/ask-ai`)
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`);

            expect(res.status).toBe(200);
            expect(answerFarmerInThread).toHaveBeenCalledWith(expect.objectContaining({ conversationId: THREAD_ID }), 'farmer_request');
        });

        it('asks the farmer to write their question first', async () => {
            jest.mocked(loadThreadForReply).mockResolvedValueOnce(thread({ question: null }) as never);
            const res = await request(app)
                .post(`/api/chatbot/conversations/${THREAD_ID}/ask-ai`)
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`);
            expect(res.status).toBe(400);
            expect(answerFarmerInThread).not.toHaveBeenCalled();
        });

        it('does not answer the same message twice', async () => {
            jest.mocked(loadThreadForReply).mockResolvedValueOnce(thread({ aiAnsweredSinceFarmer: true }) as never);
            const res = await request(app)
                .post(`/api/chatbot/conversations/${THREAD_ID}/ask-ai`)
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`);
            expect(res.status).toBe(409);
            expect(answerFarmerInThread).not.toHaveBeenCalled();
        });

        it('is the farmer\'s button, not the officer\'s', async () => {
            const res = await request(app)
                .post(`/api/chatbot/conversations/${THREAD_ID}/ask-ai`)
                .set('Authorization', `Bearer ${tokenFor('off-1', 'extension_officer')}`);
            expect(res.status).toBe(403);
        });
    });

    describe('settings', () => {
        it("gives every role their organisation's rules, with defaults", async () => {
            const res = await request(app)
                .get('/api/chatbot/turn-taking')
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({ tenantId: TENANT_ID, settings: { aiFallbackMinutes: 30, smsAiDailyLimit: 10 } });
        });

        const valid = {
            aiFallbackMinutes: 45,
            workingHours: { start: '07:30', end: '16:30', days: [1, 2, 3, 4, 5], timezone: 'Africa/Kampala' },
            aiPauseAfterOfficerMinutes: 60,
            smsAiDailyLimit: 5,
        };

        it("lets an admin set their organisation's rules", async () => {
            const res = await request(app)
                .put('/api/chatbot/turn-taking')
                .set('Authorization', `Bearer ${tokenFor('admin-1', 'admin')}`)
                .send({ settings: valid });

            expect(res.status).toBe(200);
            expect(res.body.data.settings).toEqual(valid);
            const [, params] = sqlCalls().find(([sql]) => sql.includes('UPDATE tenants'))!;
            expect(params[0]).toBe(TENANT_ID);
        });

        it('rejects invalid rules and non-admins', async () => {
            const bad = await request(app)
                .put('/api/chatbot/turn-taking')
                .set('Authorization', `Bearer ${tokenFor('admin-1', 'admin')}`)
                .send({ settings: { ...valid, workingHours: { ...valid.workingHours, timezone: 'Mars/Olympus' } } });
            expect(bad.status).toBe(400);

            const officer = await request(app)
                .put('/api/chatbot/turn-taking')
                .set('Authorization', `Bearer ${tokenFor('off-1', 'extension_officer')}`)
                .send({ settings: valid });
            expect(officer.status).toBe(403);
            expect(sqlCalls().some(([sql]) => sql.includes('UPDATE tenants'))).toBe(false);
        });
    });

    describe('a farmer sending a message', () => {
        it('checks it for urgency straight away', async () => {
            const res = await request(app)
                .post('/api/chatbot/messages')
                .set('Authorization', `Bearer ${tokenFor(FARMER_USER_ID, 'farmer')}`)
                .send({ conversation_id: THREAD_ID, content: 'My child drank pesticide' });

            expect(res.status).toBe(201);
            await new Promise(resolve => setImmediate(resolve));
            expect(respondIfUrgent).toHaveBeenCalledWith(THREAD_ID);
        });

        it("does not for an officer's message", async () => {
            const res = await request(app)
                .post('/api/chatbot/messages')
                .set('Authorization', `Bearer ${tokenFor('off-1', 'extension_officer')}`)
                .send({ conversation_id: THREAD_ID, content: 'He collapsed? Please call me' });
            expect(res.status).toBe(201);
            await new Promise(resolve => setImmediate(resolve));
            expect(respondIfUrgent).not.toHaveBeenCalled();
        });
    });
});
