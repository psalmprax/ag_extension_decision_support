/**
 * Billing hardening: manual-transaction validation and Stripe webhook rejection.
 */
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const prismaMock = {
  subscriptionPlan: { findUnique: jest.fn() },
  transactionSubmission: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
};
jest.mock('@/services/prismaService', () => ({ getPrisma: () => prismaMock }));

import { transactionService } from '@/services/transactionService';

describe('transactionService.submitTransaction validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-pro', name: 'Pro', price: 29, currency: 'USD' });
    prismaMock.transactionSubmission.findUnique.mockResolvedValue(null);
    prismaMock.transactionSubmission.findFirst.mockResolvedValue(null);
    prismaMock.transactionSubmission.create.mockResolvedValue({ id: 'sub-1' });
  });

  const base = { userId: 'u1', planId: 'plan-pro', method: 'mpesa' as const, transactionId: 'QAB12CD34E' };

  it('rejects an amount below the plan price', async () => {
    const res = await transactionService.submitTransaction({ ...base, amount: 5 });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/below the Pro plan price/);
    expect(prismaMock.transactionSubmission.create).not.toHaveBeenCalled();
  });

  it('rejects a non-positive / non-numeric amount', async () => {
    expect((await transactionService.submitTransaction({ ...base, amount: 0 })).success).toBe(false);
    expect((await transactionService.submitTransaction({ ...base, amount: Number.NaN })).success).toBe(false);
  });

  it('rejects a currency mismatch', async () => {
    const res = await transactionService.submitTransaction({ ...base, amount: 29, currency: 'KES' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/currency must be USD/);
  });

  it('rejects a malformed M-Pesa receipt', async () => {
    const res = await transactionService.submitTransaction({ ...base, amount: 29, transactionId: 'abc' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/does not look like a valid mpesa reference/);
  });

  it('accepts a valid submission that covers the plan price', async () => {
    const res = await transactionService.submitTransaction({ ...base, amount: 29 });
    expect(res.success).toBe(true);
    expect(prismaMock.transactionSubmission.create).toHaveBeenCalledTimes(1);
  });
});

// ─── Stripe webhook must not ACK unverified events ────────────────────────────
import express from 'express';
import request from 'supertest';

const verifyWebhookSignature = jest.fn();
const handleWebhook = jest.fn();
jest.mock('../services/paymentService', () => ({
  paymentService: {
    verifyWebhookSignature: (...a: unknown[]) => verifyWebhookSignature(...a),
    handleWebhook: (...a: unknown[]) => handleWebhook(...a),
  },
}));

import webhookRouter from '../routes/billing/webhook';

describe('POST /billing/webhook', () => {
  const app = express();
  app.use('/billing', webhookRouter);

  beforeEach(() => jest.clearAllMocks());

  it('returns 400 (so Stripe retries) when the signature cannot be verified', async () => {
    verifyWebhookSignature.mockReturnValue(null);
    const res = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'sig')
      .set('content-type', 'application/json')
      .send('{}');
    expect(res.status).toBe(400);
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  it('processes and ACKs a verified event', async () => {
    verifyWebhookSignature.mockReturnValue({ id: 'evt_1', type: 'invoice.paid' });
    handleWebhook.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'sig')
      .set('content-type', 'application/json')
      .send('{}');
    expect(res.status).toBe(200);
    expect(handleWebhook).toHaveBeenCalledWith({ id: 'evt_1', type: 'invoice.paid' });
  });
});
