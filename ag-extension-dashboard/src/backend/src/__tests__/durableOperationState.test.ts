/**
 * Unit tests for the DB-backed durable operation-state handlers:
 *   1. /offline   — queue mirror, retry, delete, status (offline_queue_items)
 *   2. /activities/triage — claim / release / claim-status (activity_claims)
 *   3. /billing/paypal — pending payment persistence (pending_paypal_payments)
 *
 * Prisma is mocked; these tests verify route behavior, authorization scoping,
 * and state transitions — not raw SQL.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';

type JestFn = jest.Mock;

interface MockPrisma {
    offlineQueueItem: { upsert: JestFn; findUnique: JestFn; update: JestFn; deleteMany: JestFn; groupBy: JestFn };
    activityClaim: { findUnique: JestFn; upsert: JestFn; delete: JestFn };
    pendingPaypalPayment: { upsert: JestFn; findUnique: JestFn; delete: JestFn; deleteMany: JestFn };
    subscription: { upsert: JestFn };
    payment: { create: JestFn };
}

// Prisma mock: the client object is built inside the factory because route
// modules (billing.ts) capture `getPrisma()` at module load — a lazy
// mockReturnValue set in beforeEach would be too late for them.
jest.mock('../services/prismaService', () => {
    const mockClient = {
        offlineQueueItem: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            groupBy: jest.fn(),
        },
        activityClaim: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        pendingPaypalPayment: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        subscription: {
            upsert: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        },
        payment: { create: jest.fn().mockResolvedValue({}) },
    };
    return { getPrisma: jest.fn(() => mockClient), __mockClient: mockClient };
});

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => null),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));
jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => null),
}));
jest.mock('../services/socketService', () => ({ initializeSocketHandlers: jest.fn() }));
jest.mock('../services/webrtcService', () => ({ webrtcService: { initialize: jest.fn() } }));
jest.mock('../services/notificationService', () => ({
    notificationService: { send: jest.fn().mockResolvedValue({ success: true }) },
}));
jest.mock('../services/vectorService', () => ({
    vectorService: {
        initialize: jest.fn(),
        search: jest.fn(() => Promise.resolve([])),
        upsertDocument: jest.fn(() => Promise.resolve('doc_id')),
        deleteDocument: jest.fn(() => Promise.resolve(true)),
        getDocument: jest.fn(() => Promise.resolve(null)),
        seedKnowledge: jest.fn(() => Promise.resolve(true)),
    },
}));
jest.mock('../services/aiProvider/aiProvider', () => ({
    aiProvider: {
        initialize: jest.fn(),
        generateChatResponse: jest.fn(() => Promise.resolve({ message: 'ok', language: 'en' })),
        generateEmbedding: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
        healthCheck: jest.fn(() => Promise.resolve(true)),
    },
}));
jest.mock('../services/paymentService', () => ({
    paymentService: {
        getPricingPlans: jest.fn(() => Promise.resolve([
            { id: '11111111-1111-1111-1111-111111111111', name: 'Pro', price: 19.99, interval: 'month', features: [] },
        ])),
        createPayPalPayment: jest.fn(() => Promise.resolve({
            success: true,
            paymentId: 'PAYID-TEST-1',
            approvalUrl: 'https://www.paypal.com/checkoutnow?token=TEST',
        })),
        executePayPalPayment: jest.fn(() => Promise.resolve(true)),
    },
}));
jest.mock('../services/usageService', () => ({
    usageService: {
        getUsage: jest.fn(() => Promise.resolve({})),
        getUsageStatus: jest.fn(() => Promise.resolve({ plan: { name: 'Pro', status: 'active' }, usage: [], periodEnd: new Date() })),
        checkLimit: jest.fn(() => Promise.resolve({ allowed: true, current: 0, limit: 100 })),
    },
}));
jest.mock('../workers/alertWorker', () => ({ runAlertChecks: jest.fn() }));
jest.mock('../services/knowledgeService', () => ({
    knowledgeService: {
        searchKnowledge: jest.fn(() => Promise.resolve([])),
        getArticle: jest.fn(() => Promise.resolve(null)),
    },
}));

// eslint-disable-next-line import/first
import app from '../app';
// eslint-disable-next-line import/first
const { __mockClient } = jest.requireMock('../services/prismaService') as { __mockClient: MockPrisma };

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const PLAN_ID = '11111111-1111-1111-1111-111111111111';

function tokenFor(userId: string, role: string = 'extension_officer'): string {
    return jwt.sign({ userId, email: `${userId}@test.dev`, role }, config.jwt.secret || 'test-secret', { expiresIn: '1h' });
}

describe('Durable operation-state routes (DB-backed)', () => {
    let prisma: MockPrisma;
    let token: string;

    beforeAll(() => {
        token = tokenFor(USER_ID);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        prisma = __mockClient;
        // Re-default the delegates whose defaults were cleared by clearAllMocks
        prisma.offlineQueueItem.deleteMany.mockResolvedValue({ count: 0 });
        prisma.pendingPaypalPayment.deleteMany.mockResolvedValue({ count: 0 });
        prisma.subscription.upsert.mockResolvedValue({ id: 'sub-1' });
        prisma.payment.create.mockResolvedValue({});
    });

    // ── 1. Offline queue ────────────────────────────────────────────────
    describe('POST /api/v1/offline/queue', () => {
        it('mirrors a queued request with state normalized and Authorization stripped', async () => {
            prisma.offlineQueueItem.upsert.mockResolvedValue({ clientRequestId: 'req-1', state: 'pending' });

            const response = await request(app)
                .post('/api/v1/offline/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    id: 'req-1',
                    idempotencyKey: 'idem-1',
                    url: 'https://api.example.com/api/v1/visits',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer SECRET', 'Idempotency-Key': 'idem-1' },
                    body: { notes: 'hello' },
                    attachmentRefs: ['att-1'],
                    maxRetries: 5,
                    state: 'pending',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual({ id: 'req-1', state: 'pending' });

            const call = prisma.offlineQueueItem.upsert.mock.calls[0][0];
            expect(call.where).toEqual({ userId_clientRequestId: { userId: USER_ID, clientRequestId: 'req-1' } });
            expect(call.create.headers).toEqual({ 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' });
            expect(JSON.stringify(call.create.headers)).not.toContain('SECRET');
            expect(call.create.idempotencyKey).toBe('idem-1');
            expect(call.create.attachmentRefs).toEqual(['att-1']);
        });

        it('coerces an unknown state to pending', async () => {
            prisma.offlineQueueItem.upsert.mockResolvedValue({ clientRequestId: 'req-2', state: 'pending' });

            const response = await request(app)
                .post('/api/v1/offline/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'req-2', url: 'https://api.example.com/x', method: 'POST', state: 'bogus_state' });

            expect(response.status).toBe(200);
            expect(prisma.offlineQueueItem.upsert.mock.calls[0][0].create.state).toBe('pending');
        });

        it('rejects payloads missing id/url/method', async () => {
            const response = await request(app)
                .post('/api/v1/offline/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'req-3' });

            expect(response.status).toBe(400);
            expect(prisma.offlineQueueItem.upsert).not.toHaveBeenCalled();
        });

        it('requires authentication', async () => {
            const response = await request(app)
                .post('/api/v1/offline/queue')
                .send({ id: 'req-4', url: 'https://api.example.com/x', method: 'GET' });

            expect(response.status).toBe(401);
        });

        // ── Mirror lifecycle: the extension upserts on every state transition.
        // Each upsert must land in BOTH create and update branches.
        it('mirror lifecycle: upsert update branch persists retries and state transition', async () => {
            prisma.offlineQueueItem.upsert.mockResolvedValue({ clientRequestId: 'req-1', state: 'failed' });

            const response = await request(app)
                .post('/api/v1/offline/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    id: 'req-1',
                    url: 'https://api.example.com/api/v1/visits',
                    method: 'POST',
                    headers: {},
                    retries: 2,
                    maxRetries: 3,
                    state: 'failed',
                    lastError: 'HTTP 500',
                });

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ id: 'req-1', state: 'failed' });
            const call = prisma.offlineQueueItem.upsert.mock.calls[0][0];
            expect(call.where).toEqual({ userId_clientRequestId: { userId: USER_ID, clientRequestId: 'req-1' } });
            expect(call.update).toMatchObject({
                retries: 2,
                maxRetries: 3,
                state: 'failed',
                lastError: 'HTTP 500',
            });
        });

        it('mirror lifecycle: conflict transition normalizes and records lastError', async () => {
            prisma.offlineQueueItem.upsert.mockResolvedValue({ clientRequestId: 'req-1', state: 'conflict' });

            const response = await request(app)
                .post('/api/v1/offline/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    id: 'req-1',
                    url: 'https://api.example.com/api/v1/visits',
                    method: 'POST',
                    state: 'conflict',
                    lastError: 'version conflict: visit was modified',
                });

            expect(response.status).toBe(200);
            const call = prisma.offlineQueueItem.upsert.mock.calls[0][0];
            expect(call.create.state).toBe('conflict');
            expect(call.create.lastError).toBe('version conflict: visit was modified');
        });

        it('mirror lifecycle: dead_letter transition upsert', async () => {
            prisma.offlineQueueItem.upsert.mockResolvedValue({ clientRequestId: 'req-1', state: 'dead_letter' });

            const response = await request(app)
                .post('/api/v1/offline/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    id: 'req-1',
                    url: 'https://api.example.com/api/v1/visits',
                    method: 'POST',
                    retries: 3,
                    maxRetries: 3,
                    state: 'dead_letter',
                    lastError: 'HTTP 503',
                });

            expect(response.status).toBe(200);
            const call = prisma.offlineQueueItem.upsert.mock.calls[0][0];
            expect(call.create.state).toBe('dead_letter');
            expect(call.create.retries).toBe(3);
            expect(call.update.state).toBe('dead_letter');
        });
    });

    describe('POST /api/v1/offline/retry', () => {
        it('resets a dead-letter item to pending and clears retry metadata', async () => {
            prisma.offlineQueueItem.findUnique.mockResolvedValue({
                id: 'db-uuid-1', clientRequestId: 'req-5', state: 'dead_letter',
            });

            const response = await request(app)
                .post('/api/v1/offline/retry')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'req-5' });

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ id: 'req-5', state: 'pending' });
            expect(prisma.offlineQueueItem.update).toHaveBeenCalledWith({
                where: { id: 'db-uuid-1' },
                data: expect.objectContaining({ state: 'pending', retries: 0, lastError: null, movedToDeadLetterAt: null, originalRetries: null }),
            });
        });

        it('returns 404 when the item belongs to another user', async () => {
            prisma.offlineQueueItem.findUnique.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/v1/offline/retry')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'someone-elses' });

            expect(response.status).toBe(404);
            expect(prisma.offlineQueueItem.update).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/v1/offline/delete', () => {
        it('deletes only the caller\u2019s own item', async () => {
            prisma.offlineQueueItem.deleteMany.mockResolvedValue({ count: 1 });

            const response = await request(app)
                .post('/api/v1/offline/delete')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'req-6' });

            expect(response.status).toBe(200);
            expect(prisma.offlineQueueItem.deleteMany).toHaveBeenCalledWith({
                where: { userId: USER_ID, clientRequestId: 'req-6' },
            });
        });

        it('returns 404 when nothing was deleted', async () => {
            prisma.offlineQueueItem.deleteMany.mockResolvedValue({ count: 0 });

            const response = await request(app)
                .post('/api/v1/offline/delete')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'missing' });

            expect(response.status).toBe(404);
        });
    });

        it('mirror lifecycle: delete clears a mirrored dead_letter item', async () => {
            prisma.offlineQueueItem.deleteMany.mockResolvedValue({ count: 1 });

            const response = await request(app)
                .post('/api/v1/offline/delete')
                .set('Authorization', `Bearer ${token}`)
                .send({ id: 'req-1' });

            expect(response.status).toBe(200);
            expect(prisma.offlineQueueItem.deleteMany).toHaveBeenCalledWith({
                where: { userId: USER_ID, clientRequestId: 'req-1' },
            });
        });

        it('mirror lifecycle: status counts reflect transitions after upserts', async () => {
            prisma.offlineQueueItem.groupBy.mockResolvedValue([
                { state: 'pending', _count: { _all: 2 } },
                { state: 'dead_letter', _count: { _all: 1 } },
            ]);
        it('aggregates counts by state for the caller', async () => {
            prisma.offlineQueueItem.groupBy.mockResolvedValue([
                { state: 'pending', _count: { _all: 3 } },
                { state: 'dead_letter', _count: { _all: 1 } },
            ]);

            const response = await request(app)
                .get('/api/v1/offline/status')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({
                pending: 3,
                failed: 0,
                conflict: 0,
                deadLetter: 1,
                total: 4,
            });
            expect(prisma.offlineQueueItem.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({ where: { userId: USER_ID } })
            );
        });
    });

    // ── 2. Activity claims ──────────────────────────────────────────────
    describe('POST /api/v1/activities/triage/:id/claim', () => {
        it('creates a claim when the activity is unclaimed', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue(null);
            prisma.activityClaim.upsert.mockResolvedValue({ claimedAt: new Date('2026-09-02T10:00:00Z') });

            const response = await request(app)
                .post('/api/v1/activities/triage/sms-abc/claim')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data.claimedBy).toContain('Officer');
            expect(response.body.data.claimedAt).toBe('2026-09-02T10:00:00.000Z');
            expect(prisma.activityClaim.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ where: { activityId: 'sms-abc' } })
            );
        });

        it('returns 409 when another officer holds the claim', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue({ userId: OTHER_USER_ID, claimedBy: 'Other Officer' });

            const response = await request(app)
                .post('/api/v1/activities/triage/sms-abc/claim')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(409);
            expect(response.body.error).toContain('Other Officer');
            expect(prisma.activityClaim.upsert).not.toHaveBeenCalled();
        });

        it('is idempotent for the same officer (upsert path)', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue({ userId: USER_ID, claimedBy: 'Officer' });
            prisma.activityClaim.upsert.mockResolvedValue({ claimedAt: new Date() });

            const response = await request(app)
                .post('/api/v1/activities/triage/sms-abc/claim')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(prisma.activityClaim.upsert).toHaveBeenCalled();
        });
    });

    describe('POST /api/v1/activities/triage/:id/release', () => {
        it('lets the claimer release their own claim', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue({ userId: USER_ID, claimedBy: 'Officer' });

            const response = await request(app)
                .post('/api/v1/activities/triage/sms-abc/release')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data.released).toBe(true);
            expect(prisma.activityClaim.delete).toHaveBeenCalledWith({ where: { activityId: 'sms-abc' } });
        });

        it('blocks release by a non-owning non-admin officer', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue({ userId: OTHER_USER_ID, claimedBy: 'Other Officer' });

            const response = await request(app)
                .post('/api/v1/activities/triage/sms-abc/release')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
            expect(prisma.activityClaim.delete).not.toHaveBeenCalled();
        });

        it('returns 404 when the activity was never claimed', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/v1/activities/triage/sms-abc/release')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/v1/activities/triage/:id/claim-status', () => {
        it('reports the active claim', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue({
                claimedBy: 'Officer', claimedAt: new Date('2026-09-02T10:00:00Z'),
            });

            const response = await request(app)
                .get('/api/v1/activities/triage/sms-abc/claim-status')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ claimed: true, claimedBy: 'Officer', claimedAt: '2026-09-02T10:00:00.000Z' });
        });

        it('reports unclaimed when no row exists', async () => {
            prisma.activityClaim.findUnique.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/v1/activities/triage/sms-abc/claim-status')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ claimed: false });
        });
    });

    // ── 3. PayPal pending payments ──────────────────────────────────────
    describe('POST /api/v1/billing/paypal/subscribe', () => {
        it('persists the pending payment with plan, amount, and 1h expiry', async () => {
            const response = await request(app)
                .post('/api/v1/billing/paypal/subscribe')
                .set('Authorization', `Bearer ${token}`)
                .send({ planId: PLAN_ID });

            expect(response.status).toBe(200);
            expect(response.body.data.paymentId).toBe('PAYID-TEST-1');

            const call = prisma.pendingPaypalPayment.upsert.mock.calls[0][0];
            expect(call.where).toEqual({ paymentId: 'PAYID-TEST-1' });
            expect(call.create).toEqual(expect.objectContaining({
                paymentId: 'PAYID-TEST-1',
                userId: USER_ID,
                planId: PLAN_ID,
                amount: 19.99,
            }));
            const expiry = new Date(call.create.expiresAt).getTime() - Date.now();
            expect(expiry).toBeGreaterThan(55 * 60 * 1000);
            expect(expiry).toBeLessThanOrEqual(60 * 60 * 1000);
        });

        it('rejects an unknown plan without persisting anything', async () => {
            const response = await request(app)
                .post('/api/v1/billing/paypal/subscribe')
                .set('Authorization', `Bearer ${token}`)
                .send({ planId: '99999999-9999-9999-9999-999999999999' });

            expect(response.status).toBe(400);
            expect(prisma.pendingPaypalPayment.upsert).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/v1/billing/paypal/success', () => {
        it('consumes the pending payment and activates the subscription', async () => {
            prisma.pendingPaypalPayment.findUnique.mockResolvedValue({
                paymentId: 'PAYID-TEST-1',
                planId: PLAN_ID,
                amount: 19.99,
                expiresAt: new Date(Date.now() + 3600_000),
            });

            const response = await request(app)
                .get('/api/v1/billing/paypal/success')
                .query({ paymentId: 'PAYID-TEST-1', PayerID: 'PAYER-1' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(302);
            expect(decodeURIComponent(response.headers.location)).toContain('billing?success=true');
            expect(prisma.pendingPaypalPayment.delete).toHaveBeenCalledWith({ where: { paymentId: 'PAYID-TEST-1' } });
            expect(prisma.subscription.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ where: { userId: USER_ID }, update: expect.objectContaining({ planId: PLAN_ID }) })
            );
            expect(prisma.payment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ amount: 19.99, paymentMethod: 'paypal', transactionId: 'PAYID-TEST-1' }),
                })
            );
        });

        it('redirects with plan_not_found when no pending row exists', async () => {
            prisma.pendingPaypalPayment.findUnique.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/v1/billing/paypal/success')
                .query({ paymentId: 'PAYID-UNKNOWN', PayerID: 'PAYER-1' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toContain('error=plan_not_found');
            expect(prisma.subscription.upsert).not.toHaveBeenCalled();
        });

        it('redirects with plan_not_found when the pending row is expired', async () => {
            prisma.pendingPaypalPayment.findUnique.mockResolvedValue({
                paymentId: 'PAYID-TEST-1',
                planId: PLAN_ID,
                amount: 19.99,
                expiresAt: new Date(Date.now() - 1000),
            });

            const response = await request(app)
                .get('/api/v1/billing/paypal/success')
                .query({ paymentId: 'PAYID-TEST-1', PayerID: 'PAYER-1' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toContain('error=plan_not_found');
            expect(prisma.subscription.upsert).not.toHaveBeenCalled();
        });
    });
});
