process.env.BOT_CHECK_SECRET = 'unit-test-bot-secret';

jest.mock('@/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { createHmac } from 'crypto';
import type { Request, Response } from 'express';
import { signupHumanCheck, issueSignupChallenge } from '@/middleware/botDefense';

/** A token signed exactly as the server does, with a chosen issue time. */
function tokenIssuedMsAgo(ms: number): string {
    const issuedAt = Date.now() - ms;
    const sig = createHmac('sha256', process.env.BOT_CHECK_SECRET as string).update(String(issuedAt)).digest('hex');
    return `v1.${issuedAt}.${sig}`;
}

function run(body: Record<string, unknown>) {
    const req = { body } as Request;
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json } as unknown as Response;
    const next = jest.fn();
    signupHumanCheck(req, res, next);
    return { next, status: res.status as jest.Mock, json };
}

describe('signupHumanCheck', () => {
    it('passes a real sign-up: no honeypot, a token old enough to have been filled in', () => {
        const { next, status } = run({ email: 'a@b.test', website: '', formToken: tokenIssuedMsAgo(4000) });
        expect(next).toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
    });

    it('passes when no token is sent (not required by default), so existing clients keep working', () => {
        const { next } = run({ email: 'a@b.test' });
        expect(next).toHaveBeenCalled();
    });

    it('rejects a filled honeypot as a bot', () => {
        const { next, status, json } = run({ email: 'a@b.test', website: 'http://spam.example' });
        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'SIGNUP_REJECTED' }));
    });

    it('rejects a form submitted faster than a person could fill it', () => {
        const { next, status } = run({ email: 'a@b.test', formToken: tokenIssuedMsAgo(100) });
        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(400);
    });

    it('rejects an expired token', () => {
        const { next, status } = run({ email: 'a@b.test', formToken: tokenIssuedMsAgo(3 * 60 * 60 * 1000) });
        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(400);
    });

    it('rejects a tampered signature without throwing', () => {
        const good = tokenIssuedMsAgo(4000);
        const tampered = good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a');
        const { next, status } = run({ email: 'a@b.test', formToken: tampered });
        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(400);
    });

    it('rejects a malformed token', () => {
        const { next, status } = run({ email: 'a@b.test', formToken: 'not-a-token' });
        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(400);
    });

    it('issues a challenge token the check then accepts once enough time has passed', () => {
        const json = jest.fn();
        const res = { json } as unknown as Response;
        issueSignupChallenge({} as Request, res);
        const { token, minFillMs } = json.mock.calls[0][0].data;
        expect(typeof token).toBe('string');
        expect(minFillMs).toBeGreaterThan(0);
        // Freshly issued → too fast now.
        expect((run({ formToken: token }).status as jest.Mock)).toHaveBeenCalledWith(400);
        // The same token, signed for a time far enough in the past, is accepted.
        const parts = token.split('.');
        const past = Number(parts[1]) - (minFillMs + 2000);
        const sig = createHmac('sha256', process.env.BOT_CHECK_SECRET as string).update(String(past)).digest('hex');
        expect(run({ formToken: `v1.${past}.${sig}` }).next).toHaveBeenCalled();
    });
});
