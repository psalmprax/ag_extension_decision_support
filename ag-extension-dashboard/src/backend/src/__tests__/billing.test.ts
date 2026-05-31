import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Mock all services to avoid real DB/Cache connections
jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({
        query: jest.fn().mockResolvedValue({ 
            rows: [{ count: 0 }],
            rowCount: 1 
        })
    })),
    query: jest.fn().mockResolvedValue({ 
        rows: [{ count: 0 }],
        rowCount: 1 
    })
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => ({
        isOpen: true,
        get: jest.fn(),
        set: jest.fn()
    }))
}));

jest.mock('../services/socketService', () => ({
    initializeSocketHandlers: jest.fn()
}));

jest.mock('../services/webrtcService', () => ({
    webrtcService: {
        initialize: jest.fn()
    }
}));

jest.mock('../services/notificationService', () => ({
    notificationService: {
        send: jest.fn().mockResolvedValue({ success: true })
    }
}));

jest.mock('../services/usageService', () => ({
    usageService: {
        getUsage: jest.fn(() => Promise.resolve({
            id: 'usage_1',
            smsCount: 10,
            aiChatCount: 5,
            reportCount: 2,
            plan: { name: 'Pro' }
        })),
        getUsageStatus: jest.fn(() => Promise.resolve({
            plan: { name: 'Pro', status: 'active' },
            usage: [
                { type: 'ai_chat', current: 5, limit: 100, label: 'AI ADVISOR CREDITS' },
                { type: 'sms', current: 10, limit: 500, label: 'SMS BROADCASTS' },
                { type: 'report', current: 2, limit: 50, label: 'ANALYTIC REPORTS' }
            ],
            periodEnd: new Date()
        })),
        checkLimit: jest.fn(() => Promise.resolve({
            allowed: true,
            current: 10,
            limit: 100
        }))
    }
}));

jest.mock('../services/paymentService', () => ({
    paymentService: {
        getPricingPlans: jest.fn(() => Promise.resolve([
            { id: '1', name: 'Basic', price: 9.99, interval: 'month', features: [] },
            { id: '2', name: 'Pro', price: 19.99, interval: 'month', features: [] }
        ])),
        createCheckoutSession: jest.fn(() => Promise.resolve({ url: 'https://checkout.stripe.com/test' })),
        getSubscription: jest.fn(() => Promise.resolve(null)),
        cancelSubscription: jest.fn(() => Promise.resolve({ success: true })),
        switchSubscription: jest.fn(() => Promise.resolve({ success: true })),
        getPaymentMethods: jest.fn(() => Promise.resolve({
            success: true,
            data: [{ id: 'pm_1', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 }]
        })),
        getOrCreateCustomer: jest.fn(() => Promise.resolve('cus_123')),
        getInvoices: jest.fn(() => Promise.resolve([])),
        createPortalSession: jest.fn(() => Promise.resolve('https://billing.stripe.com/test'))
    }
}));

jest.mock('../services/prismaService', () => ({
    getPrisma: jest.fn(() => ({
        subscription: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({})
        },
        subscriptionPlan: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(null)
        },
        user: {
            findUnique: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' })
        }
    }))
}));

jest.mock('../services/vectorService', () => ({
    vectorService: {
        initialize: jest.fn(),
        search: jest.fn(() => Promise.resolve([])),
        upsertDocument: jest.fn(() => Promise.resolve('doc_id')),
        deleteDocument: jest.fn(() => Promise.resolve(true)),
        getDocument: jest.fn(() => Promise.resolve(null)),
        seedKnowledge: jest.fn(() => Promise.resolve(true))
    }
}));

jest.mock('../services/aiProvider/aiProvider', () => ({
    aiProvider: {
        initialize: jest.fn(),
        generateChatResponse: jest.fn(() => Promise.resolve({ message: 'Test response', language: 'en' })),
        generateEmbedding: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
        healthCheck: jest.fn(() => Promise.resolve(true))
    }
}));

jest.mock('../workers/alertWorker', () => ({
    runAlertChecks: jest.fn()
}));

jest.mock('../services/knowledgeService', () => ({
    knowledgeService: {
        searchKnowledge: jest.fn(() => Promise.resolve([])),
        getArticle: jest.fn(() => Promise.resolve(null))
    }
}));

describe('Billing API Integration Tests', () => {
    let token: string;

    beforeAll(() => {
        // Generate a test token
        token = jwt.sign(
            { userId: '1', role: 'extension_officer', email: 'test@example.com' },
            config.jwt.secret || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    describe('GET /api/billing/usage', () => {
        it('should return usage data for authenticated user', async () => {
            const response = await request(app)
                .get('/api/billing/usage')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });

        it('should return 401 if no token provided', async () => {
            const response = await request(app).get('/api/billing/usage');
            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/billing/plans', () => {
        it('should return subscription plans', async () => {
            const response = await request(app)
                .get('/api/billing/plans')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });

    describe('GET /api/billing/subscription', () => {
        it('should return subscription data', async () => {
            const response = await request(app)
                .get('/api/billing/subscription')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/billing/payment-methods', () => {
        it('should return payment methods', async () => {
            const response = await request(app)
                .get('/api/billing/payment-methods')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });
});
