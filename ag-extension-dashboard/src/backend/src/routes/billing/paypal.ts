import { Router } from 'express';
import { paymentService } from '../../services/paymentService';
import { getPrisma } from '../../services/prismaService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import {
  creditPayPalPass,
  PAYPAL_PASS_DAYS,
  applyPayPalSubscriptionEvent,
  parsePayPalSubscriptionCustomId,
} from '@/services/paypalLifecycleService';
import {
  createPayPalSubscription,
  getPayPalSubscription,
} from '@/services/paypalSubscriptionService';

// PayPal checkout is a ONE-TIME sale, so it grants a fixed-length prepaid pass rather
// than an auto-renewing subscription. Two writers share one idempotent implementation
// (services/paypalLifecycleService.ts): this browser return handler and the
// signature-verified webhook in ./paypalWebhook.ts.
// A buyer who wants an auto-renewing plan uses POST /paypal/subscription instead —
// a real PayPal Subscriptions API profile whose lifecycle the webhook owns.

const router = Router();

const prisma = getPrisma();

const errorStatusMap: Record<string, number> = {
    'PAYMENT_GATEWAY_NOT_CONFIGURED': 200,
    'STRIPE_ERROR': 402,
    'PAYPAL_ERROR': 402,
    'ACTIVE_SUBSCRIPTION_EXISTS': 409,
    'ALREADY_SUBSCRIBED': 400
};

/**
 * @swagger
 * /api/v1/billing/paypal/subscribe:
 *   post:
 *     summary: Create PayPal subscription
 *     tags: [Billing]
 */
// Pending PayPal payments persist in the DB (pending_paypal_payments) so that a
// process restart or multi-instance deployment never loses an in-flight checkout.
// Entries expire after 1 hour; cleanup runs opportunistically on insert.
async function storePendingPaypalPayment(paymentId: string, userId: string, planId: string, amount: number): Promise<void> {
    const expiresAt = new Date(Date.now() + 3600_000);
    await prisma.pendingPaypalPayment.upsert({
        where: { paymentId },
        update: { planId, amount, userId, expiresAt, status: 'pending' },
        create: { paymentId, userId, planId, amount, expiresAt },
    });
    // Opportunistic expiry sweep — keeps the table bounded without a worker.
    prisma.pendingPaypalPayment.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(err => {
        logger.warn('Pending PayPal payment sweep failed:', err);
    });
}

async function loadPendingPaypalPayment(paymentId: string): Promise<{ planId: string; amount: number; userId: string } | null> {
    const pending = await prisma.pendingPaypalPayment.findUnique({ where: { paymentId } });
    if (!pending) return null;
    if (pending.expiresAt.getTime() < Date.now()) {
        await deletePendingPaypalPayment(paymentId);
        return null;
    }
    return { planId: pending.planId, amount: Number(pending.amount), userId: pending.userId };
}

async function deletePendingPaypalPayment(paymentId: string): Promise<void> {
    try {
        await prisma.pendingPaypalPayment.delete({ where: { paymentId } });
    } catch (error) {
        // Non-fatal: the sale is idempotent on payment id via the payments table,
        // so a stale pending row cannot double-credit the buyer.
        logger.warn(`Could not clear pending PayPal payment ${paymentId}:`, error);
    }
}

router.post('/paypal/subscribe', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user!.userId;

        if (!planId) {
            return res.status(400).json({ success: false, message: 'Plan ID is required' });
        }

        const plans = await paymentService.getPricingPlans();
        const selectedPlan = plans.find(p => p.id === planId);

        if (!selectedPlan) {
            return res.status(400).json({ success: false, message: 'Invalid plan ID' });
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const result = await paymentService.createPayPalPayment({
            userId,
            amount: selectedPlan.price,
            currency: 'USD',
            description: `${selectedPlan.name} Plan Subscription`,
            returnUrl: `${baseUrl}/billing/paypal/success`,
            cancelUrl: `${baseUrl}/billing/paypal/cancel`
        });

        if (result && result.success) {
            // Store plan details for the success callback (durable across restarts)
            if (result.paymentId) {
                await storePendingPaypalPayment(result.paymentId, userId, selectedPlan.id, selectedPlan.price);
            }
            res.json({ success: true, data: { paymentId: result.paymentId, approvalUrl: result.approvalUrl } });
        } else {
            res.status(errorStatusMap[result?.errorCode as string] || 400).json({
                success: false,
                errorCode: result?.errorCode || 'PAYPAL_ERROR',
                message: result?.message || 'Failed to initiate PayPal subscription'
            });
        }
    } catch (error) {
        logger.error('Failed to create PayPal subscription:', error);
        safeError(res, 500, 'Failed to initiate PayPal subscription');
    }
});

/**
 * @swagger
 * /api/v1/billing/paypal/subscription:
 *   post:
 *     summary: Create a real auto-renewing PayPal subscription (Subscriptions API)
 *     tags: [Billing]
 */
// Unlike /paypal/subscribe (a one-time sale granting a prepaid pass), this creates a
// PayPal Subscriptions API profile that renews automatically. Lifecycle events
// (activation, renewal payments, cancellation) are owned by the signature-verified
// webhook in ./paypalWebhook.ts; the return route below verifies and activates.
router.post('/paypal/subscription', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user!.userId;

        if (!planId) {
            return res.status(400).json({ success: false, message: 'Plan ID is required' });
        }

        const plans = await paymentService.getPricingPlans();
        const selectedPlan = plans.find(p => p.id === planId);

        if (!selectedPlan) {
            return res.status(400).json({ success: false, message: 'Invalid plan ID' });
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const result = await createPayPalSubscription({
            userId,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            price: selectedPlan.price,
            interval: selectedPlan.interval,
            returnUrl: `${baseUrl}/billing/paypal/subscription-return`,
            cancelUrl: `${baseUrl}/billing/paypal/cancel`,
        });

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Failed to create PayPal recurring subscription:', error);
        // Upstream PayPal/API failure — map like the other gateway errors (PAYPAL_ERROR → 402).
        safeError(res, 402, 'Failed to create PayPal recurring subscription');
    }
});

/**
 * @swagger
 * /api/v1/billing/paypal/subscription-return:
 *   get:
 *     summary: Handle PayPal subscription approval return
 *     tags: [Billing]
 */
// PayPal redirects here with subscription_id after the buyer approves. The webhook
// BILLING.SUBSCRIPTION.ACTIVATED event owns the state for unattended flows; this
// return path verifies the subscription against PayPal and activates idempotently
// so the buyer is not left waiting on webhook latency.
router.get('/paypal/subscription-return', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    const frontendBase = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`;
    try {
        const { subscription_id: subscriptionId } = req.query;
        const userId = req.user!.userId;

        if (!subscriptionId || typeof subscriptionId !== 'string') {
            return res.redirect(`${frontendBase}?error=missing_params`);
        }

        const details = await getPayPalSubscription(subscriptionId);
        const identity = parsePayPalSubscriptionCustomId(details.customId);

        // The subscription's custom_id binds it to the user who created the checkout.
        // A mismatch means this session user is not the buyer — refuse to activate.
        if (!identity || identity.userId !== userId) {
            logger.warn(
                `PayPal subscription ${subscriptionId} custom_id ${details.customId ?? 'missing'} does not match session user ${userId} — refusing to activate`
            );
            return res.redirect(`${frontendBase}?error=payer_mismatch`);
        }

        if (details.status !== 'ACTIVE' && details.status !== 'APPROVED') {
            logger.warn(`PayPal subscription ${subscriptionId} returned status ${details.status} — not activating`);
            return res.redirect(`${frontendBase}?error=payment_failed`);
        }

        await applyPayPalSubscriptionEvent({
            userId: identity.userId,
            planId: identity.planId,
            status: 'active',
            periodEnd: details.nextBillingTime ?? undefined,
        });
        logger.info(`PayPal subscription ${subscriptionId} activated for ${identity.userId} via return flow`);

        res.redirect(`${frontendBase}?success=true&payment=paypal-subscription`);
    } catch (error) {
        logger.error('PayPal subscription return handling failed:', error);
        res.redirect(`${frontendBase}?error=server_error`);
    }
});

/**
 * @swagger
 * /api/v1/billing/paypal/success:
 *   get:
 *     summary: Handle PayPal payment success
 *     tags: [Billing]
 */
router.get('/paypal/success', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const { paymentId, PayerID } = req.query;
        const userId = req.user!.userId;

        if (!paymentId || !PayerID) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=missing_params`);
        }

        const success = await paymentService.executePayPalPayment(paymentId as string, PayerID as string);

        if (success) {
            // Look up plan details from pending payment (DB-backed, restart-safe).
            // The row is only cleared once the sale is confirmed bound to the payer.
            const pending = await loadPendingPaypalPayment(paymentId as string);

            if (!pending) {
                logger.error(`PayPal payment ${paymentId} succeeded but no pending plan found`);
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=plan_not_found`);
            }

            // The subscription belongs to whoever initiated the checkout, not to
            // whoever follows the return URL. Reject mismatches (admins excepted) and
            // keep the pending row so the actual payer can still complete the sale.
            if (pending.userId !== userId && req.user!.role !== 'admin') {
                logger.warn(`PayPal payment ${paymentId} initiated by ${pending.userId} but completed by ${userId} — refusing to bind`);
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=payer_mismatch`);
            }
            const targetUserId = pending.userId;

            await deletePendingPaypalPayment(paymentId as string);

            const credit = await creditPayPalPass({
                paymentId: paymentId as string,
                userId: targetUserId,
                planId: pending.planId,
                amount: pending.amount,
            });
            logger.info(
                `PayPal ${PAYPAL_PASS_DAYS}-day pass for ${targetUserId} ` +
                `${credit.alreadyRecorded ? 'already credited' : 'credited'} until ${credit.currentPeriodEnd.toISOString()}`
            );

            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true&payment=paypal`);
        } else {
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=payment_failed`);
        }
    } catch (error) {
        logger.error('PayPal success handling failed:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=server_error`);
    }
});

/**
 * @swagger
 * /api/v1/billing/paypal/cancel:
 *   get:
 *     summary: Handle PayPal payment cancellation
 *     tags: [Billing]
 */
router.get('/paypal/cancel', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true&payment=paypal`);
});

export default router;
