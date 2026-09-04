import { Router } from 'express';
import { paymentService } from '../../services/paymentService';
import { getPrisma } from '../../services/prismaService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

// PayPal subscription state is created/updated only here. There is no PayPal webhook
// equivalent in this codebase, so this success handler is the single PayPal subscription
// writer. See services/paymentService.ts for the ownership contract.

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

async function consumePendingPaypalPayment(paymentId: string): Promise<{ planId: string; amount: number; userId: string } | null> {
    const pending = await prisma.pendingPaypalPayment.findUnique({ where: { paymentId } });
    if (!pending) return null;
    await prisma.pendingPaypalPayment.delete({ where: { paymentId } });
    if (pending.expiresAt.getTime() < Date.now()) return null;
    return { planId: pending.planId, amount: Number(pending.amount), userId: pending.userId };
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
            // Look up plan details from pending payment (DB-backed, restart-safe)
            const pending = await consumePendingPaypalPayment(paymentId as string);

            if (!pending) {
                logger.error(`PayPal payment ${paymentId} succeeded but no pending plan found`);
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=plan_not_found`);
            }

            // The subscription belongs to whoever initiated the checkout, not to
            // whoever follows the return URL. Reject mismatches (admins excepted).
            if (pending.userId !== userId && req.user!.role !== 'admin') {
                logger.warn(`PayPal payment ${paymentId} initiated by ${pending.userId} but completed by ${userId} — refusing to bind`);
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=payer_mismatch`);
            }
            const targetUserId = pending.userId;

            // Update subscription in database
            const subscription = await prisma.subscription.upsert({
                where: { userId: targetUserId },
                update: {
                    status: 'active',
                    planId: pending.planId,
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                },
                create: {
                    userId: targetUserId,
                    planId: pending.planId,
                    status: 'active',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });

            // Create payment record
            await prisma.payment.create({
                data: {
                    subscriptionId: subscription.id,
                    amount: pending.amount,
                    currency: 'USD',
                    status: 'completed',
                    paymentMethod: 'paypal',
                    transactionId: paymentId as string,
                    paidAt: new Date()
                }
            });

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
