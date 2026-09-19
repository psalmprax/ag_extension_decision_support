/**
 * PayPal webhook — signature-verified, idempotent entitlement writer.
 *
 * PayPal's REST webhooks are verified against PayPal's own signature service before
 * the payload is trusted. This handler owns the paths the browser return flow cannot:
 * completion without a return (closed tab / mobile app switch) and refunds.
 */
import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { paymentService } from '@/services/paymentService';
import {
  creditPayPalPass,
  lookupPendingPayPalPayment,
  voidPayPalPayment,
  applyPayPalSubscriptionEvent,
  parsePayPalSubscriptionCustomId,
} from '@/services/paypalLifecycleService';

const router = Router();

interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    parent_payment?: string;
    sale_id?: string;
    /** Subscriptions API events carry "<userId>:<planId>". */
    custom_id?: string;
    billing_subscription_id?: string;
    status?: string;
    amount?: { total?: string; currency?: string };
    billing_info?: { next_billing_time?: string };
  };
}

/** PayPal's classic sale flow reports the checkout id as `parent_payment`. */
function resolveSalePaymentId(resource: PayPalWebhookEvent['resource']): string | null {
  return resource?.parent_payment || resource?.sale_id || resource?.id || null;
}

/** Status strings the lifecycle writer accepts, per BILLING.SUBSCRIPTION.* event. */
const SUBSCRIPTION_EVENT_STATUS: Record<string, 'active' | 'cancelled' | 'suspended' | 'expired'> = {
  'BILLING.SUBSCRIPTION.ACTIVATED': 'active',
  'BILLING.SUBSCRIPTION.CANCELLED': 'cancelled',
  'BILLING.SUBSCRIPTION.SUSPENDED': 'suspended',
  'BILLING.SUBSCRIPTION.EXPIRED': 'expired',
};

async function handleCompletedSale(event: PayPalWebhookEvent, paymentId: string | null): Promise<void> {
  if (!paymentId) {
    logger.warn('PayPal PAYMENT.SALE.COMPLETED without a resolvable payment id');
    return;
  }
  const pending = await lookupPendingPayPalPayment(paymentId);
  if (pending) {
    await creditPayPalPass({
      paymentId,
      userId: pending.userId,
      planId: pending.planId,
      amount: pending.amount,
    });
    return;
  }
  // Subscription renewals arrive as PAYMENT.SALE.COMPLETED with a custom_id
  // ("<userId>:<planId>") and no pending checkout row. The payment extends the
  // entitlement period exactly like the one-time-sale pass (idempotent on the
  // sale id), keeping the active period aligned with actual renewals.
  const renewal = parsePayPalSubscriptionCustomId(event?.resource?.custom_id);
  if (renewal) {
    const amount = Number(event?.resource?.amount?.total || 0);
    await creditPayPalPass({
      paymentId,
      userId: renewal.userId,
      planId: renewal.planId,
      amount,
    });
    return;
  }
  // Either the browser return handler already consumed the row (both paths
  // are idempotent, so this is expected), or the sale is not ours.
  logger.info(`PayPal sale ${paymentId} has no pending checkout — treated as already credited or foreign`);
  return;
}

router.post('/paypal/webhook', async (req: Request, res: Response) => {
  const event = req.body as PayPalWebhookEvent;

  const verification = await paymentService.verifyPayPalWebhookSignature(
    req.headers as Record<string, string | string[] | undefined>,
    event,
  );
  if (!verification.verified) {
    logger.warn(`Rejected PayPal webhook: ${verification.reason || 'signature verification failed'}`);
    return res.status(401).json({ success: false, error: 'Webhook signature verification failed' });
  }

  const eventType = event?.event_type;
  const paymentId = resolveSalePaymentId(event?.resource);

  try {
    switch (eventType) {
      case 'PAYMENT.SALE.COMPLETED': {
        await handleCompletedSale(event, paymentId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const identity = parsePayPalSubscriptionCustomId(event?.resource?.custom_id);
        if (!identity) {
          logger.warn(`PayPal ${eventType} without a resolvable custom_id`);
          break;
        }
        await applyPayPalSubscriptionEvent({
          userId: identity.userId,
          planId: identity.planId,
          status: SUBSCRIPTION_EVENT_STATUS[eventType],
          periodEnd: event?.resource?.billing_info?.next_billing_time
            ? new Date(event.resource.billing_info.next_billing_time)
            : undefined,
        });
        break;
      }

      case 'PAYMENT.SALE.REFUNDED':
      case 'PAYMENT.SALE.REVERSED': {
        if (!paymentId) {
          logger.warn(`PayPal ${eventType} without a resolvable payment id`);
          break;
        }
        await voidPayPalPayment({ paymentId });
        break;
      }

      default:
        // Acknowledge unknown events so PayPal does not retry forever, but never act
        // on them. Logged so unhandled lifecycle events are visible to operators.
        logger.info(`PayPal webhook ${eventType ?? 'unknown'} acknowledged with no handler`);
    }

    return res.json({ success: true, received: true });
  } catch (error) {
    logger.error(`PayPal webhook ${eventType} processing failed:`, error);
    // 5xx asks PayPal to retry — correct for a transient DB failure.
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;
