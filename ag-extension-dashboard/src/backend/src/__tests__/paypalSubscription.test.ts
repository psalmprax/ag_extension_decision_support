/**
 * PayPal Subscriptions API: recurring billing profiles, webhook attribution, and
 * lifecycle event handling. Complements the one-time-sale pass tests in billing.test.ts.
 */
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

const prismaMock = {
  subscription: { upsert: jest.fn(), findUnique: jest.fn() },
  payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  pendingPaypalPayment: { findUnique: jest.fn(), upsert: jest.fn() },
};
jest.mock('@/services/prismaService', () => ({ getPrisma: () => prismaMock }));

const paymentServiceMock = {
  paypalApiBase: () => 'https://api-m.sandbox.paypal.com',
  fetchPayPalAccessToken: jest.fn().mockResolvedValue('pp-token'),
  verifyPayPalWebhookSignature: jest.fn().mockResolvedValue({ verified: true }),
};
jest.mock('@/services/paymentService', () => ({ paymentService: paymentServiceMock }));

import axios from 'axios';
import request from 'supertest';
import express from 'express';
import {
  createPayPalSubscription,
  getPayPalSubscription,
} from '@/services/paypalSubscriptionService';
import {
  applyPayPalSubscriptionEvent,
  parsePayPalSubscriptionCustomId,
} from '@/services/paypalLifecycleService';
import paypalWebhookRouter from '@/routes/billing/paypalWebhook';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
  paymentServiceMock.fetchPayPalAccessToken.mockResolvedValue('pp-token');
  paymentServiceMock.verifyPayPalWebhookSignature.mockResolvedValue({ verified: true });
});

describe('paypalSubscriptionService.createPayPalSubscription', () => {
  it('creates a product, a plan, and a subscription carrying custom_id and the cent→major price', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'prod-1' } }) // catalog product
      .mockResolvedValueOnce({ data: { id: 'plan-pp-1' } }) // billing plan
      .mockResolvedValueOnce({
        data: {
          id: 'sub-pp-1',
          links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/approve' }],
        },
      }); // subscription

    const result = await createPayPalSubscription({
      userId: USER_ID,
      planId: PLAN_ID,
      planName: 'Pro',
      price: 2900,
      interval: 'month',
      returnUrl: 'https://app.test/billing/paypal/subscription-return',
      cancelUrl: 'https://app.test/billing/paypal/cancel',
    });

    expect(result.subscriptionId).toBe('sub-pp-1');
    expect(result.approvalUrl).toBe('https://www.sandbox.paypal.com/approve');

    const subPost = mockedAxios.post.mock.calls[2];
    expect(subPost[0]).toBe('https://api-m.sandbox.paypal.com/v1/billing/subscriptions');
    const body = subPost[1] as Record<string, unknown>;
    expect(body.custom_id).toBe(`${USER_ID}:${PLAN_ID}`);

    const planPost = mockedAxios.post.mock.calls[1];
    expect(planPost[0]).toBe('https://api-m.sandbox.paypal.com/v1/billing/plans');
    const cycles = ((planPost[1] as Record<string, unknown>).billing_cycles as Array<{
      frequency: { interval_unit: string };
      total_cycles: number;
      pricing_scheme: { fixed_price: { value: string; currency_code: string } };
    }>);
    expect(cycles[0].pricing_scheme.fixed_price.value).toBe('29.00');
    expect(cycles[0].pricing_scheme.fixed_price.currency_code).toBe('USD');
    expect(cycles[0].frequency.interval_unit).toBe('MONTH');
    expect(cycles[0].total_cycles).toBe(0);
  });

  it('falls back to MONTH for an unknown interval', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'prod-2' } })
      .mockResolvedValueOnce({ data: { id: 'plan-pp-2' } })
      .mockResolvedValueOnce({ data: { id: 'sub-pp-2', links: [{ rel: 'approve', href: 'https://x' }] } });

    await createPayPalSubscription({
      userId: USER_ID,
      planId: PLAN_ID,
      planName: 'Enterprise',
      price: 9900,
      interval: 'quarter',
      returnUrl: 'https://app.test/return',
      cancelUrl: 'https://app.test/cancel',
    });

    const planPost = mockedAxios.post.mock.calls[1];
    const cycles = ((planPost[1] as Record<string, unknown>).billing_cycles as Array<{ frequency: { interval_unit: string } }>);
    expect(cycles[0].frequency.interval_unit).toBe('MONTH');
  });

  it('caches product/plan ids per tier — a second checkout skips re-creation', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'prod-3' } })
      .mockResolvedValueOnce({ data: { id: 'plan-pp-3' } })
      .mockResolvedValueOnce({ data: { id: 'sub-pp-3a', links: [{ rel: 'approve', href: 'https://x' }] } })
      .mockResolvedValueOnce({ data: { id: 'sub-pp-3b', links: [{ rel: 'approve', href: 'https://x' }] } });

    const input = {
      userId: USER_ID,
      planId: PLAN_ID,
      planName: 'Cached',
      price: 1900,
      interval: 'year',
      returnUrl: 'https://app.test/return',
      cancelUrl: 'https://app.test/cancel',
    };
    await createPayPalSubscription(input);
    await createPayPalSubscription(input);

    // 4 POSTs total: product + plan + two subscriptions (no repeated product/plan).
    expect(mockedAxios.post).toHaveBeenCalledTimes(4);
    expect(mockedAxios.post.mock.calls[3][0]).toContain('/v1/billing/subscriptions');
  });
});

describe('paypalSubscriptionService.getPayPalSubscription', () => {
  it('returns status, custom_id, and a parsed next billing time', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ACTIVE',
        custom_id: `${USER_ID}:${PLAN_ID}`,
        billing_info: { next_billing_time: '2026-10-15T00:00:00Z' },
      },
    });

    const details = await getPayPalSubscription('sub-pp-9');
    expect(details.status).toBe('ACTIVE');
    expect(details.customId).toBe(`${USER_ID}:${PLAN_ID}`);
    expect(details.nextBillingTime?.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });
});

describe('parsePayPalSubscriptionCustomId', () => {
  it('parses a valid userId:planId pair (lowercased)', () => {
    expect(parsePayPalSubscriptionCustomId(`${USER_ID.toUpperCase()}:${PLAN_ID}`)).toEqual({
      userId: USER_ID,
      planId: PLAN_ID,
    });
  });

  it('rejects non-UUID or malformed custom ids', () => {
    expect(parsePayPalSubscriptionCustomId('garbage')).toBeNull();
    expect(parsePayPalSubscriptionCustomId('not-a-uuid:also-not')).toBeNull();
    expect(parsePayPalSubscriptionCustomId(undefined)).toBeNull();
  });
});

describe('applyPayPalSubscriptionEvent', () => {
  it('activates with the PayPal next billing time', async () => {
    prismaMock.subscription.upsert.mockResolvedValue({ id: 's1' });
    const end = new Date('2026-11-15T00:00:00Z');
    await applyPayPalSubscriptionEvent({ userId: USER_ID, planId: PLAN_ID, status: 'active', periodEnd: end });

    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        update: expect.objectContaining({ status: 'active', currentPeriodEnd: end }),
      })
    );
  });

  it('marks terminal states without touching the period fields', async () => {
    prismaMock.subscription.upsert.mockResolvedValue({ id: 's1' });
    await applyPayPalSubscriptionEvent({ userId: USER_ID, planId: PLAN_ID, status: 'cancelled' });

    const call = prismaMock.subscription.upsert.mock.calls[0][0];
    expect(call.update.status).toBe('cancelled');
    expect(call.update.currentPeriodEnd).toBeUndefined();
  });
});

describe('paypalWebhook BILLING.SUBSCRIPTION.* events', () => {
  const app = express();
  app.use(express.json());
  app.use(paypalWebhookRouter);

  it('activates a subscription from the ACTIVATED event', async () => {
    prismaMock.subscription.upsert.mockResolvedValue({ id: 's1' });
    const res = await request(app)
      .post('/paypal/webhook')
      .send({
        id: 'wh-1',
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        resource: {
          id: 'sub-pp-1',
          custom_id: `${USER_ID}:${PLAN_ID}`,
          billing_info: { next_billing_time: '2026-10-15T00:00:00Z' },
        },
      });
    expect(res.status).toBe(200);
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ status: 'active' }) })
    );
  });

  it('credits a subscription renewal SALE.COMPLETED attributed via custom_id', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null); // no pending checkout row
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue({ id: 's1' });
    prismaMock.payment.create.mockResolvedValue({ id: 'p1' });

    const res = await request(app)
      .post('/paypal/webhook')
      .send({
        id: 'wh-2',
        event_type: 'PAYMENT.SALE.COMPLETED',
        resource: {
          id: 'sale-9',
          custom_id: `${USER_ID}:${PLAN_ID}`,
          amount: { total: '29.00', currency: 'USD' },
        },
      });
    expect(res.status).toBe(200);
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ transactionId: 'sale-9', paymentMethod: 'paypal' }),
    });
  });

  it('still rejects unverified signatures before any entitlement write', async () => {
    paymentServiceMock.verifyPayPalWebhookSignature.mockResolvedValue({
      verified: false,
      reason: 'bad signature',
    });
    const res = await request(app)
      .post('/paypal/webhook')
      .send({ id: 'wh-3', event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { custom_id: `${USER_ID}:${PLAN_ID}` } });
    expect(res.status).toBe(401);
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });
});
