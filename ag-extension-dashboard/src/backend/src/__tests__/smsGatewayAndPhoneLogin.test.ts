jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() } }));
jest.mock('@/services/smsService', () => ({
    smsService: { sendSMS: jest.fn().mockResolvedValue(true), formatPhoneNumber: (p: string) => `+${p.replace(/\D/g, '').replace(/^0/, '254')}` },
}));

import type { NextFunction, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import { smsService } from '@/services/smsService';
import { verifySmsGatewayWebhook } from '@/middleware/webhookSignature';
import { checkLoginCode, normalisePhone, requestLoginCode } from '@/services/phoneLoginService';

const mockQuery = query as jest.Mock;

function call(reqPart: Partial<Request>) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
    const next = jest.fn() as NextFunction;
    verifySmsGatewayWebhook({ headers: {}, query: {}, body: {}, ...reqPart } as Request, res, next);
    return { res, next };
}

describe("Africa's Talking callbacks", () => {
    const saved = { ...process.env };
    beforeEach(() => {
        process.env.AFRICASTALKING_WEBHOOK_SECRET = 'at-secret';
        delete process.env.META_APP_SECRET;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.ALLOW_UNSIGNED_WEBHOOKS_FOR_LOCAL_DEV;
    });
    afterAll(() => { process.env = saved; });

    it('accepts the shared key in the query or the header', () => {
        expect(call({ query: { key: 'at-secret' } as never }).next).toHaveBeenCalled();
        expect(call({ headers: { 'x-gateway-secret': 'at-secret' } }).next).toHaveBeenCalled();
    });

    it('refuses a wrong key', () => {
        const { res, next } = call({ query: { key: 'guess' } as never });
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('refuses a callback with no key and no provider signature', () => {
        const { next } = call({});
        expect(next).not.toHaveBeenCalled();
    });
});

describe('sign-in codes by SMS', () => {
    beforeEach(() => jest.clearAllMocks());

    it('normalises local numbers and refuses junk', () => {
        expect(normalisePhone('0712 345 678')).toBe('+254712345678');
        expect(normalisePhone('12')).toBeNull();
    });

    it('stops after three codes for a number in 15 minutes', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ by_phone: '3', by_ip: '3' }] });
        await expect(requestLoginCode('+254712345678', '1.2.3.4')).resolves.toBe('rate_limited');
        expect(smsService.sendSMS).not.toHaveBeenCalled();
    });

    it('sends nothing to a number with no account and no farmer record', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        mockQuery.mockResolvedValueOnce({ rows: [{ by_phone: '0', by_ip: '0' }] });
        await expect(requestLoginCode('+254712345678', '1.2.3.4')).resolves.toBe('unknown_number');
        expect(smsService.sendSMS).not.toHaveBeenCalled();
    });

    it('stores only a hash of the code it sends', async () => {
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes('COUNT(*) FILTER')) return Promise.resolve({ rows: [{ by_phone: '0', by_ip: '0' }] });
            if (sql.includes('FROM users u')) return Promise.resolve({ rows: [{ id: 'u1', role: 'farmer', is_active: true }] });
            return Promise.resolve({ rows: [] });
        });
        await expect(requestLoginCode('+254712345678', '1.2.3.4')).resolves.toBe('sent');
        const code = /(\d{6})/.exec(jest.mocked(smsService.sendSMS).mock.calls[0][0].message)![1];
        const insert = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO phone_login_codes'))!;
        expect(insert[1]).not.toContain(code);
        expect(String(insert[1][1])).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects an expired code and counts wrong tries up to five', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', code_hash: 'ab', attempts: 0, expired: true }] });
        await expect(checkLoginCode('+254712345678', '123456')).resolves.toBe('expired');

        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', code_hash: '00'.repeat(32), attempts: 4, expired: false }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(checkLoginCode('+254712345678', '123456')).resolves.toBe('too_many_attempts');

        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', code_hash: '00'.repeat(32), attempts: 5, expired: false }] });
        await expect(checkLoginCode('+254712345678', '123456')).resolves.toBe('too_many_attempts');
    });
});
