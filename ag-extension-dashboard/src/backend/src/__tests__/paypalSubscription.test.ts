/**
 * PayPal Subscriptions API: plan ensure/create, custom_id attribution, webhook
 * lifecycle mapping, and the return-flow activation contract.
 */
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockAxios = { post: jest.fn(), get: jest.fn() };
jest.mock('axios', () => ({ __esModule: true, default: mockAxios }));

const mockPaymentService = {
  paypalApiBase: () => 'https://api-m.sandbox.paypal.com',
  fetchPayPalAccessToken: jest.fn(),
};
jest.mock('@/services/paymentService', () => ({ paymentService: mockPaymentService }));

const prismaMock = {
  subscription: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};
jest.mock('@/services/prismaService', () => ({ getPrisma: () => prismaMock }));

import { createPayPalSubscription, getPayPalSubscription } from '@/services/paypalSubscriptionService';
import {
  applyPayPalSubscriptionEvent,
  parsePayPalSubscriptionCustomId,
} from '@/services/paypalLifecycleService';

const USER = '11111111-1111-4111-8111-111111111111';
const PLAN = '22222222-2222-4222-8222-222222222222';

describe('parsePayPalSubscriptionCustomId', () => {
  it('accepts the exact "<userId>:<planId>" UUID shape', () => {
    expect(parsePayPalSubscriptionCustomId(`${USER}:${PLAN}`)).toEqual({ userId: USER, planId: PLAN });
  });

  it('rejects malformed, partial, and non-string custom ids', () => {
    expect(parsePayPalSubscriptionCustomId('not-a-pair')).toBeNull();
    expect(parsePayPalSubscriptionCustomId(`${USER}`)).toBeNull();
    expect(parsePayPalSubscriptionCustomId(`${USER}:nope`)).toBeNull();
    expect(parsePayPalSubscriptionCustomId(42)).toBeNull();
    expect(parsePayPalSubscriptionCustomId(undefined)).toBeNull();
  });
});

describe('createPayPalSubscription', () => {
  const input = {
    userId: USER,
    planId: PLAN,
    planName: 'Pro',
    price: 2900,
    interval: 'month',
    returnUrl: 'https://app.example/billing/paypal/subscription-return',
    cancelUrl: 'https://app.example/billing/paypal/cancel',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentService.fetchPayPalAccessToken.mockResolvedValue('token-123');
  });

  it('creates product, plan, and subscription; carries custom_id and cents→major price', async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: { id: 'prod-1' } }) // catalog product
      .mockResolvedValueOnce({ data: { id: 'plan-1' } }) // billing plan
      .mockResolvedValueOnce({
        data: { id: 'sub-1', links: [{ rel: 'approve', href: 'https://paypal.test/approve' }] },
      });

    const result = await createPayPalSubscription(input);

    expect(result).toEqual({ subscriptionId: 'sub-1', approvalUrl: 'https://paypal.test/approve' });

    const planCall = mockAxios.post.mock.calls[1];
    expect(planCall[0]).toBe('https://api-m.sandbox.paypal.com/v1/billing/plans');
    expect(planCall[1].billing_cycles[0].pricing_scheme.fixed_price).toEqual({ value: '29.00', currency_code: 'USD' });
    expect(planCall[1].billing_cycles[0].frequency).toEqual({ interval_unit: 'MONTH', interval_count: 1 });

    const subCall = mockAxios.post.mock.calls[2];
    expect(subCall[0]).toBe('https://api-m.sandbox.paypal.com/v1/billing/subscriptions');
    expect(subCall[1].custom_id).toBe(`${USER}:${PLAN}`);
    expect(subCall[1].application_context.user_action).toBe('SUBSCRIBE_NOW');
    expect(subCall[1].application_context.return_url).toBe(input.returnUrl);
  });

  it('caches product/plan per tier — a second subscription only creates the subscription', async () => {
    mockAxios.post.mockResolvedValue({
      data: { id: 'sub-2', links: [{ rel: 'approve', href: 'https://paypal.test/approve-2' }] },
    });

    await createPayPalSubscription({ ...input, planName: 'CachedTier' });
    const callsAfterFirst = mockAxios.post.mock.calls.length;
    await createPayPalSubscription({ ...input, planName: 'CachedTier' });

    expect(mockAxios.post.mock.calls.length).toBe(callsAfterFirst + 1);
    expect(mockAxios.post.mock.calls[callsAfterFirst][0]).toContain('/v1/billing/subscriptions');
  });

  it('throws a PAYPAL_SUBSCRIPTION_ERROR when PayPal returns no approve link', async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: { id: 'prod-x' } })
      .mockResolvedValueOnce({ data: { id: 'plan-x' } })
      .mockResolvedValueOnce({ data: { id: 'sub-x', links: [] } });

    await expect(createPayPalSubscription({ ...input, planName: 'BrokenTier' })).rejects.toThrow(
      /PAYPAL_SUBSCRIPTION_ERROR/
    );
  });
});

describe('getPayPalSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentService.fetchPayPalAccessToken.mockResolvedValue('token-123');
  });

  it('returns status, custom_id, and parsed next billing time', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        status: 'ACTIVE',
        custom_id: `${USER}:${PLAN}`,
        billing_info: { next_billing_time: '2026-10-15T00:00:00Z' },
      },
    });

    const details = await getPayPalSubscription('sub-1');
    expect(details.status).toBe('ACTIVE');
    expect(details.customId).toBe(`${USER}:${PLAN}`);
    expect(details.nextBillingTime?.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('tolerates a missing billing_info', async () => {
    mockAxios.get.mockResolvedValue({ data: { status: 'APPROVED' } });
    const details = await getPayPalSubscription('sub-2');
    expect(details.nextBillingTime).toBeNull();
    expect(details.customId).toBeNull();
  });
});

describe('applyPayPalSubscriptionEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.subscription.upsert.mockResolvedValue({ id: 'row-1' });
  });

  it('activates with the next billing time as the period end', async () => {
    const periodEnd = new Date('2026-10-15T00:00:00Z');
    await applyPayPalSubscriptionEvent({ userId: USER, planId: PLAN, status: 'active', periodEnd });

    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        update: expect.objectContaining({
          status: 'active',
          planId: PLAN,
          currentPeriodEnd: periodEnd,
          expiryNotificationSent: false,
        }),
      })
    );
  });

  it('marks terminal states without extending the period', async () => {
    await applyPayPalSubscriptionEvent({ userId: USER, planId: PLAN, status: 'cancelled' });

    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        update: expect.objectContaining({ status: 'cancelled' }),
      })
    );
    const update = prismaMock.subscription.upsert.mock.calls[0][0].update;
    expect(update.currentPeriodEnd).toBeUndefined();
  });
});
