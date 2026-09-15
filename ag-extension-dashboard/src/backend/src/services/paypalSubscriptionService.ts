/**
 * PayPal Subscriptions API — real auto-renewing billing profiles.
 *
 * The classic PayPal checkout in this app is a one-time sale granting a fixed-length
 * prepaid pass (services/paypalLifecycleService.ts). This module adds true recurring
 * subscriptions via PayPal's Subscriptions API (/v1/catalogs/products +
 * /v1/billing/plans + /v1/billing/subscriptions) so a buyer who wants an
 * auto-renewing plan gets one instead of re-buying a pass every cycle.
 *
 * - Product/plan ids are ensured idempotently and cached per (name, price, interval).
 * - The subscription carries custom_id = "<userId>:<planId>" so webhook events
 *   (BILLING.SUBSCRIPTION.*, PAYMENT.SALE.COMPLETED renewals) attribute to the user.
 * - Entitlement writes funnel through services/paypalLifecycleService.ts, sharing one
 *   definition of subscription state with the one-time-sale pass flow.
 * - Failures throw with a PAYPAL_SUBSCRIPTION_ERROR-prefixed message; routes map to 502.
 */
import axios from 'axios';
import { paymentService } from './paymentService';
import { logger } from '../utils/logger';

export interface PayPalSubscriptionInput {
  userId: string;
  planId: string;
  planName: string;
  /** Plan price in CENTS (the same unit the classic sale flow receives). */
  price: number;
  /** Billing interval: 'month' | 'year' | 'week' | 'day' (Stripe interval values). */
  interval: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalSubscriptionCreated {
  subscriptionId: string;
  approvalUrl: string;
}

/** PayPal interval units; unknown intervals fall back to MONTH (30-day equivalence). */
function intervalUnit(interval: string): 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' {
  const normalized = interval.toLowerCase();
  if (normalized === 'day') return 'DAY';
  if (normalized === 'week') return 'WEEK';
  if (normalized === 'year') return 'YEAR';
  return 'MONTH';
}

/** Ensure-and-cache the catalog product for a plan tier (one product per name). */
const productIds = new Map<string, string>();
/** Ensure-and-cache the billing plan for a (name, price, interval) tier. */
const planIds = new Map<string, string>();

async function ensureProduct(name: string, token: string): Promise<string> {
  const cached = productIds.get(name);
  if (cached) return cached;

  const { data } = await axios.post(
    `${paymentService.paypalApiBase()}/v1/catalogs/products`,
    {
      name: `AgriExtension ${name}`,
      type: 'SERVICE',
      category: 'SOFTWARES',
    },
    paypalJsonConfig(token)
  );
  const productId = data?.id;
  if (!productId) throw new Error('PAYPAL_SUBSCRIPTION_ERROR: product response contained no id');
  productIds.set(name, productId);
  return productId;
}

function paypalJsonConfig(token: string) {
  return {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 20_000,
  };
}

async function ensurePlan(input: PayPalSubscriptionInput, token: string): Promise<string> {
  const cacheKey = `${input.planName}:${input.price}:${input.interval}`;
  const cached = planIds.get(cacheKey);
  if (cached) return cached;

  const productId = await ensureProduct(input.planName, token);
  const { data } = await axios.post(
    `${paymentService.paypalApiBase()}/v1/billing/plans`,
    {
      product_id: productId,
      name: `${input.planName} (auto-renew)`,
      billing_cycles: [
        {
          frequency: { interval_unit: intervalUnit(input.interval), interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // infinite renewals
          pricing_scheme: { fixed_price: { value: (input.price / 100).toFixed(2), currency_code: 'USD' } },
        },
      ],
      payment_preferences: { auto_bill_outstanding: true },
    },
    paypalJsonConfig(token)
  );
  const planId = data?.id;
  if (!planId) throw new Error('PAYPAL_SUBSCRIPTION_ERROR: billing plan response contained no id');
  planIds.set(cacheKey, planId);
  logger.info(`PayPal billing plan ensured for ${cacheKey}: ${planId}`);
  return planId;
}

/** Create a real auto-renewing PayPal subscription and return its approval link. */
export async function createPayPalSubscription(
  input: PayPalSubscriptionInput
): Promise<PayPalSubscriptionCreated> {
  const token = await paymentService.fetchPayPalAccessToken();
  const planId = await ensurePlan(input, token);

  const { data } = await axios.post(
    `${paymentService.paypalApiBase()}/v1/billing/subscriptions`,
    {
      plan_id: planId,
      // Webhook attribution: BILLING.SUBSCRIPTION.* and renewal PAYMENT.SALE.COMPLETED
      // events carry this back so entitlement writes land on the right user.
      custom_id: `${input.userId}:${input.planId}`,
      application_context: {
        brand_name: 'AgriExtension',
        locale: 'en-US',
        user_action: 'SUBSCRIBE_NOW',
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    },
    paypalJsonConfig(token)
  );

  const subscriptionId = data?.id;
  const approveLink = Array.isArray(data?.links)
    ? (data.links as Array<{ rel?: string; href?: string }>).find(l => l.rel === 'approve')?.href
    : undefined;
  if (!subscriptionId || !approveLink) {
    throw new Error('PAYPAL_SUBSCRIPTION_ERROR: subscription response contained no id/approve link');
  }
  logger.info(`PayPal subscription ${subscriptionId} created for ${input.userId}`);
  return { subscriptionId, approvalUrl: approveLink };
}

export interface PayPalSubscriptionDetails {
  status: string;
  customId: string | null;
  nextBillingTime: Date | null;
}

/** Fetch a subscription's live state from PayPal (return-flow verification). */
export async function getPayPalSubscription(subscriptionId: string): Promise<PayPalSubscriptionDetails> {
  const token = await paymentService.fetchPayPalAccessToken();
  const { data } = await axios.get(
    `${paymentService.paypalApiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    paypalJsonConfig(token)
  );
  const nextBilling = data?.billing_info?.next_billing_time
    ? new Date(String(data.billing_info.next_billing_time))
    : null;
  return {
    status: String(data?.status ?? 'UNKNOWN'),
    customId: typeof data?.custom_id === 'string' ? data.custom_id : null,
    nextBillingTime: nextBilling && !Number.isNaN(nextBilling.getTime()) ? nextBilling : null,
  };
}
