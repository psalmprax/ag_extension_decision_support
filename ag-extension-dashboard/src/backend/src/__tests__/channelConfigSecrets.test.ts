import request from 'supertest';
import express from 'express';

const mockQuery = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args), getPool: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/dataGovernanceService', () => ({ getPrincipalTenantId: jest.fn().mockResolvedValue('11111111-1111-4111-8111-111111111111') }));
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { userId: '22222222-2222-4222-8222-222222222222', role: 'admin' };
        next();
    },
}));

import router, { maskSecretFields } from '@/routes/channels';

describe('channel credentials', () => {
    it('masks token, key, secret and sid fields and leaves the rest', () => {
        expect(maskSecretFields({ botToken: '123456:ABCDEFGHIJ', apiKey: 'abcdefghij', authSecret: 'zzzzzzzz', accountSid: 'AC12345678', senderId: 'AG-EXTEND' }))
            .toEqual({ botToken: '123••••HIJ', apiKey: 'abc••••hij', authSecret: 'zzz••••zzz', accountSid: 'AC1••••678', senderId: 'AG-EXTEND' });
    });

    it('keeps a saved credential when the page sends back its mask, and never returns it', async () => {
        const app = express();
        app.use(express.json());
        app.use(router);
        mockQuery.mockReset();
        mockQuery
            .mockResolvedValueOnce({ rows: [{ config: { botToken: '123456:REALTOKEN', botUsername: 'old' } }] })
            .mockImplementationOnce((_sql: string, params: unknown[]) => Promise.resolve({ rows: [{ channel: 'telegram', config: JSON.parse(String(params[4])) }] }));
        const res = await request(app).patch('/config').send({ channel: 'telegram', isEnabled: true, config: { botToken: '123••••KEN', botUsername: 'new' } });
        expect(res.status).toBe(200);
        expect(JSON.parse(String(mockQuery.mock.calls[1][1][4]))).toEqual({ botToken: '123456:REALTOKEN', botUsername: 'new' });
        expect(JSON.stringify(res.body)).not.toContain('REALTOKEN');
    });

    it('keeps the saved switch, provider and welcome message when a request leaves them out', async () => {
        const app = express();
        app.use(express.json());
        app.use(router);
        mockQuery.mockReset();
        mockQuery
            .mockResolvedValueOnce({ rows: [{ config: { botToken: '123456:REALTOKEN' }, provider: 'telegram', is_enabled: true, auto_onboarding: false, welcome_template: 'Karibu' }] })
            .mockImplementationOnce((_sql: string, params: unknown[]) => Promise.resolve({ rows: [{ channel: 'telegram', config: JSON.parse(String(params[4])) }] }));
        await request(app).patch('/config').send({ channel: 'telegram', config: { botUsername: 'new' } });
        const [, , provider, isEnabled, , autoOnboarding, welcome] = mockQuery.mock.calls[1][1];
        expect([provider, isEnabled, autoOnboarding, welcome]).toEqual(['telegram', true, false, 'Karibu']);
    });
});
