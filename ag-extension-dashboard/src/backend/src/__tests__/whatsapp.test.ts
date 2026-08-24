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
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() },
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

// ─── Inbound Webhook Signature Verification ─────────────────────────────────

jest.mock('../services/onboardingEngine', () => ({
    onboardingEngine: {
        processIncomingMessage: jest.fn().mockResolvedValue({ isHandled: false }),
    },
}));

jest.mock('../services/whatsappService', () => ({
    whatsappService: {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        isConfigured: jest.fn(() => false),
    },
}));

import crypto from 'crypto';
import { verifyInboundWebhookSignature } from '../middleware/webhookSignature';

describe('POST /inbound — provider signature verification', () => {
    const ORIGINAL_ENV = { ...process.env };

    afterAll(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    afterEach(() => {
        delete process.env.META_APP_SECRET;
        delete process.env.TWILIO_AUTH_TOKEN;
        process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
    });

    const signedPayload = (secret: string, payload: string): string =>
        `sha256=${crypto.createHmac('sha256', secret).update(Buffer.from(payload, 'utf8')).digest('hex')}`;

    it('allows unsigned requests in dev when no provider secret is configured', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wa-1' }], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/whatsapp/inbound')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ from: '+265999000333', body: 'Hello', messageId: 'm-dev' }));

        expect(response.status).toBe(202);
        expect(response.body.success).toBe(true);
    });

    it('accepts a valid Meta X-Hub-Signature-256', async () => {
        process.env.META_APP_SECRET = 'test-meta-app-secret';
        const raw = JSON.stringify({ from: '+265999000444', body: 'Hi', messageId: 'm-ok' });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wa-2' }], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/whatsapp/inbound')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signedPayload(process.env.META_APP_SECRET, raw))
            .send(raw);

        expect(response.status).toBe(202);
    });

    it('rejects an invalid Meta signature with 403', async () => {
        process.env.META_APP_SECRET = 'test-meta-app-secret';
        const raw = JSON.stringify({ from: '+265999000555', body: 'Hi', messageId: 'm-bad' });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wa-3' }], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/whatsapp/inbound')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signedPayload('wrong-secret', raw))
            .send(raw);

        expect(response.status).toBe(403);
    });

    it('rejects a missing signature header when META_APP_SECRET is configured', async () => {
        process.env.META_APP_SECRET = 'test-meta-app-secret';

        const response = await request(app)
            .post('/api/v1/whatsapp/inbound')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ from: '+265999000666', body: 'Forged', messageId: 'm-none' }));

        expect(response.status).toBe(403);
    });

    it('refuses traffic with 503 in production when no provider secret is configured', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.META_APP_SECRET;
        delete process.env.TWILIO_AUTH_TOKEN;

        const response = await request(app)
            .post('/api/v1/whatsapp/inbound')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ from: '+265999000777', body: 'Hi' }));

        expect(response.status).toBe(503);
    });
});

describe('verifyInboundWebhookSignature — Twilio provider path', () => {

    const buildReq = (form: Record<string, string>, signature?: string) => ({
        headers: signature ? { 'x-twilio-signature': signature } : {},
        protocol: 'https',
        originalUrl: '/api/v1/whatsapp/inbound',
        get: (name: string) => (name.toLowerCase() === 'host' ? 'api.gpexts.com' : undefined),
        body: { ...form },
        rawBody: Buffer.from(JSON.stringify(form), 'utf8'),
    });

    const buildRes = () => {
        const res: { status?: jest.Mock; json?: jest.Mock; statusCode?: number } = {};
        res.status = jest.fn((code: number) => {
            res.statusCode = code;
            return res;
        });
        res.json = jest.fn();
        return res;
    };

    afterEach(() => {
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.META_APP_SECRET;
    });

    it('accepts a correctly signed Twilio payload', () => {
        process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
        const form: Record<string, string> = { From: 'whatsapp:+265999000888', Body: 'Hello from Twilio', To: 'whatsapp:+14155238886' };
        const url = 'https://api.gpexts.com/api/v1/whatsapp/inbound';
        const sortedParams = Object.keys(form).sort().reduce((acc, key) => acc + key + form[key], '');
        const sig = crypto.createHmac('sha1', 'test-twilio-auth-token').update(Buffer.from(url + sortedParams, 'utf8')).digest('base64');

        const next = jest.fn();
        verifyInboundWebhookSignature(buildReq(form, sig) as never, buildRes() as never, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects a forged Twilio payload with 403', () => {
        process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
        const form = { From: 'whatsapp:+265999000999', Body: 'Forged' };

        const res = buildRes();
        verifyInboundWebhookSignature(buildReq(form, 'forged-signature') as never, res as never, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Webhook signature verification failed' });
    });
});
