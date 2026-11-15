/**
 * PayPal classic-sale flow over REST (replaces the abandoned paypal-rest-sdk).
 * Exercises the real paymentService with axios mocked at the network edge.
 */
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() }, post: jest.fn() }));
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../services/systemConfigService', () => ({
    systemConfigService: { getPayPalKey: jest.fn(), getStripeKey: jest.fn() },
}));

import axios from 'axios';

const mockPost = axios.post as unknown as jest.Mock;
const SANDBOX = 'https://api-m.sandbox.paypal.com';

type Svc = typeof import('../services/paymentService')['paymentService'];

/** Gateways initialise asynchronously, so the env must stay set until ready. */
async function loadService(env: Record<string, string | undefined>): Promise<Svc> {
    const saved = { ...process.env };
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    let svc!: Svc;
    jest.isolateModules(() => {
        svc = require('../services/paymentService').paymentService;
    });
    try {
        await svc.whenReady();
    } finally {
        process.env = saved;
    }
    return svc;
}

const createParams = {
    userId: 'u-1', amount: 1999, currency: 'USD', description: 'Pro plan',
    returnUrl: 'https://app.example/ok', cancelUrl: 'https://app.example/cancel',
};

function tokenThen(response: unknown) {
    mockPost
        .mockResolvedValueOnce({ data: { access_token: 'tok-123' } })
        .mockImplementationOnce(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve({ data: response })));
}

describe('PayPal REST sale flow', () => {
    let svc: Svc;

    beforeEach(async () => {
        mockPost.mockReset();
        svc = await loadService({ PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'secret', STRIPE_SECRET_KEY: undefined });
    });

    it('creates a sale with a bearer token and returns the approval URL', async () => {
        tokenThen({ id: 'PAYID-1', state: 'created', links: [{ rel: 'approval_url', href: 'https://paypal/approve' }] });
        const result = await svc.createPayPalPayment(createParams);
        expect(result).toEqual({ success: true, paymentId: 'PAYID-1', approvalUrl: 'https://paypal/approve' });

        expect(mockPost.mock.calls[0][0]).toBe(`${SANDBOX}/v1/oauth2/token`);
        const [url, body, opts] = mockPost.mock.calls[1];
        expect(url).toBe(`${SANDBOX}/v1/payments/payment`);
        expect(opts.headers.Authorization).toBe('Bearer tok-123');
        expect(body).toMatchObject({
            intent: 'sale',
            redirect_urls: { return_url: createParams.returnUrl, cancel_url: createParams.cancelUrl },
            transactions: [{ amount: { currency: 'USD', total: '19.99' } }],
        });
    });

    it('surfaces PayPal error names instead of a bare HTTP status', async () => {
        const err = Object.assign(new Error('Request failed with status code 400'), {
            response: { data: { name: 'VALIDATION_ERROR', message: 'Invalid request' } },
        });
        tokenThen(err);
        const result = await svc.createPayPalPayment(createParams);
        expect(result).toMatchObject({ success: false, errorCode: 'PAYPAL_ERROR', message: 'VALIDATION_ERROR: Invalid request' });
    });

    it('rejects a created payment that has no approval link', async () => {
        tokenThen({ id: 'PAYID-2', links: [] });
        const result = await svc.createPayPalPayment(createParams);
        expect(result).toMatchObject({ success: false, errorCode: 'PAYPAL_ERROR' });
    });

    it('executes an approved payment', async () => {
        tokenThen({ id: 'PAYID-1', state: 'approved' });
        await expect(svc.executePayPalPayment('PAYID-1', 'PAYER-9')).resolves.toBe(true);
        const [url, body] = mockPost.mock.calls[1];
        expect(url).toBe(`${SANDBOX}/v1/payments/payment/PAYID-1/execute`);
        expect(body).toEqual({ payer_id: 'PAYER-9' });
    });

    it('does NOT grant payment when PayPal returns 2xx with state "failed"', async () => {
        tokenThen({ id: 'PAYID-1', state: 'failed' });
        await expect(svc.executePayPalPayment('PAYID-1', 'PAYER-9')).resolves.toBe(false);
    });

    it('url-encodes the payment id', async () => {
        tokenThen({ id: 'x', state: 'approved' });
        await svc.executePayPalPayment('../admin?x=1', 'P');
        expect(mockPost.mock.calls[1][0]).toBe(`${SANDBOX}/v1/payments/payment/..%2Fadmin%3Fx%3D1/execute`);
    });

    it('returns false (never throws) when the network call fails', async () => {
        tokenThen(new Error('ECONNRESET'));
        await expect(svc.executePayPalPayment('PAYID-1', 'P')).resolves.toBe(false);
    });
});

describe('PayPal unconfigured', () => {
    it('reports PAYMENT_GATEWAY_NOT_CONFIGURED without touching the network', async () => {
        mockPost.mockReset();
        const svc = await loadService({ PAYPAL_CLIENT_ID: undefined, PAYPAL_CLIENT_SECRET: undefined });
        const result = await svc.createPayPalPayment(createParams);
        expect(result).toMatchObject({ success: false, errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED' });
        expect(mockPost).not.toHaveBeenCalled();
    });
});
