/**
 * PayPal entitlement lifecycle.
 *
 * PayPal checkout here is a ONE-TIME sale (intent: 'sale'), not an auto-renewing
 * billing profile. What the buyer receives is therefore a fixed-length prepaid pass.
 * Two parties can credit it:
 *   - routes/billing/paypal.ts  — the browser return handler (attended flow)
 *   - routes/billing/paypalWebhook.ts — signature-verified PayPal webhook (unattended
 *     completion, renewals, refunds)
 * All writes funnel through this module so both paths share one idempotency rule and
 * one definition of the pass length. Expired passes are lapsed by workers/alertWorker.
 */
import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';

/** Length of the prepaid entitlements granted by a one-time PayPal sale. */
export const PAYPAL_PASS_DAYS = 30;

/** Nominal currency for PayPal checkout (the PayPal flow is USD-only today). */
export const PAYPAL_CURRENCY = 'USD';

function passEnd(from: Date): Date {
  return new Date(from.getTime() + PAYPAL_PASS_DAYS * 24 * 60 * 60 * 1000);
}

export interface PayPalCreditResult {
  subscriptionId: string;
  /** True when the sale was already recorded (duplicate delivery / webhook + return). */
  alreadyRecorded: boolean;
  currentPeriodEnd: Date;
}

/**
 * Credit a completed PayPal sale to a user.
 *
 * Idempotent on the PayPal payment id: a webhook that lands after (or before) the
 * browser return handler must not create a second payment row or extend the pass
 * twice. A short grace window is applied on genuine renewals so back-to-back sales
 * extend rather than truncate the pass.
 */
export async function creditPayPalPass(params: {
  paymentId: string;
  userId: string;
  planId: string;
  amount: number;
}): Promise<PayPalCreditResult> {
  const prisma = getPrisma();

  const existingPayment = await prisma.payment.findFirst({
    where: { transactionId: params.paymentId },
  });
  if (existingPayment) {
    const existingSub = await prisma.subscription.findUnique({ where: { userId: params.userId } });
    logger.info(`PayPal sale ${params.paymentId} already recorded — no double credit`);
    return {
      subscriptionId: existingSub?.id ?? existingPayment.subscriptionId,
      alreadyRecorded: true,
      currentPeriodEnd: existingSub?.currentPeriodEnd ?? passEnd(new Date()),
    };
  }

  const now = new Date();
  const subscription = await prisma.subscription.findUnique({ where: { userId: params.userId } });
  // Extend from the later of "now" and the current period end so a renewal bought
  // early adds time instead of discarding what is left.
  const base = subscription?.currentPeriodEnd && subscription.currentPeriodEnd > now
    ? subscription.currentPeriodEnd
    : now;
  const end = passEnd(base);

  const savedSubscription = await prisma.subscription.upsert({
    where: { userId: params.userId },
    update: {
      status: 'active',
      planId: params.planId,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      expiryNotificationSent: false,
    },
    create: {
      userId: params.userId,
      planId: params.planId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: end,
    },
  });

  await prisma.payment.create({
    data: {
      subscriptionId: savedSubscription.id,
      amount: params.amount,
      currency: PAYPAL_CURRENCY,
      status: 'completed',
      paymentMethod: 'paypal',
      transactionId: params.paymentId,
      paidAt: now,
    },
  });

  logger.info(`PayPal sale ${params.paymentId} credited to ${params.userId} until ${end.toISOString()}`);
  return { subscriptionId: savedSubscription.id, alreadyRecorded: false, currentPeriodEnd: end };
}

/**
 * Reverse a refunded or reversed PayPal sale. Idempotent: a repeated refund event
 * leaves the already-refunded row untouched.
 */
export async function voidPayPalPayment(params: { paymentId: string }): Promise<{ voided: boolean }> {
  const prisma = getPrisma();

  const payment = await prisma.payment.findFirst({ where: { transactionId: params.paymentId } });
  if (!payment) {
    logger.warn(`PayPal reversal for unknown payment ${params.paymentId} — nothing to reverse`);
    return { voided: false };
  }
  if (payment.status === 'refunded') return { voided: true };

  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
  try {
    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: 'refunded' },
    });
  } catch (error) {
    logger.error(`PayPal refund ${params.paymentId}: payment marked refunded but subscription update failed:`, error);
  }
  logger.info(`PayPal payment ${params.paymentId} reversed`);
  return { voided: true };
}

/**
 * Look up the pending checkout a PayPal sale belongs to, keyed on the exact PayPal
 * payment id PayPal reports as `parent_payment`. Deliberately exact-match only: any
 * "most recent pending" heuristic could bind a sale to the wrong user.
 * Does not consume the row (the return handler may still need it).
 */
export async function lookupPendingPayPalPayment(paymentId: string): Promise<{
  userId: string;
  planId: string;
  amount: number;
} | null> {
  const prisma = getPrisma();
  const pending = await prisma.pendingPaypalPayment.findUnique({ where: { paymentId } });
  if (!pending) return null;
  if (pending.expiresAt.getTime() < Date.now()) {
    logger.warn(`PayPal payment ${paymentId} matched an expired pending checkout`);
    return null;
  }
  return { userId: pending.userId, planId: pending.planId, amount: Number(pending.amount) };
}
