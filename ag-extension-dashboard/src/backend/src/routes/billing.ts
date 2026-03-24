import express, { Router } from 'express';
import { paymentService } from '../services/paymentService';
import { systemConfigService } from '../services/systemConfigService';
import { getPrisma } from '../services/prismaService';
import { logger } from '../utils/logger';
import { authorize, AuthRequest } from '../middleware/authorize';
import { usageService } from '../services/usageService';

const router = Router();
const prisma = getPrisma();

// Helper to check if subscription is active
const isSubscriptionActive = (subscription: { status: string }): boolean => {
    if (!subscription) return false;
    const validStatuses = ['active', 'trialing', 'past_due'];
    return validStatuses.includes(subscription.status);
};

/**
 * @swagger
 * /api/v1/billing/plans:
 *   get:
 *     summary: Get available pricing plans
 *     tags: [Billing]
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await paymentService.getPricingPlans();
        res.json({ success: true, data: plans });
    } catch (error) {
        logger.error('Failed to get plans:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve pricing plans' });
    }
});

/**
 * @swagger
 * /api/v1/billing/subscription:
 *   get:
 *     summary: Get current user subscription
 *     tags: [Billing]
 */
router.get('/subscription', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });

        if (!subscription) {
            return res.json({ success: true, data: null });
        }

        res.json({ success: true, data: subscription });
    } catch (error) {
        logger.error('Failed to get subscription:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/usage:
 *   get:
 *     summary: Get user usage statistics
 *     tags: [Billing]
 */
router.get('/usage', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const usageData = await usageService.getUsageStatus(req.user!.userId);
        res.json({ success: true, data: usageData });
    } catch (error) {
        logger.error('Failed to get usage:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/subscribe:
 *   post:
 *     summary: Create a checkout session
 *     tags: [Billing]
 */
router.post('/subscribe', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const { priceId, billingCycle = 'current' } = req.body;
        const userId = req.user!.userId;

        if (!priceId) {
            return res.status(400).json({ success: false, message: 'Price ID is required' });
        }

        const currentSubscription = await prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });

        const hasStripeSubscription = currentSubscription && currentSubscription.stripeSubscriptionId;

        if (currentSubscription && isSubscriptionActive(currentSubscription) && hasStripeSubscription) {
            const currentPlanPriceId = currentSubscription.plan?.stripePriceId;
            const currentPlanName = currentSubscription.plan?.name;
            const isSamePlan = currentPlanPriceId === priceId;

            if (billingCycle === 'current') {
                if (isSamePlan) {
                    return res.status(400).json({
                        success: false,
                        errorCode: 'ALREADY_SUBSCRIBED',
                        message: `You are already subscribed to the ${currentPlanName} plan.`,
                        subscription: currentSubscription
                    });
                } else {
                    return res.status(409).json({
                        success: false,
                        errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS',
                        message: `You already have an active ${currentPlanName} subscription.`,
                        suggestedAction: 'switch',
                        currentSubscription
                    });
                }
            } else if (billingCycle === 'next') {
                if (isSamePlan) {
                    if (currentSubscription.cancelAtPeriodEnd) {
                        const success = await paymentService.switchSubscription(
                            currentSubscription.stripeSubscriptionId!,
                            priceId,
                            false
                        );
                        if (success) {
                            await prisma.subscription.update({
                                where: { userId },
                                data: { cancelAtPeriodEnd: false }
                            });
                            return res.json({
                                success: true,
                                message: `Successfully scheduled renewal for ${currentPlanName}.`
                            });
                        }
                    } else {
                        return res.status(400).json({
                            success: false,
                            message: `Your ${currentPlanName} subscription is already set to renew.`
                        });
                    }
                } else {
                    return res.status(409).json({
                        success: false,
                        errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS',
                        message: `You have an active ${currentPlanName} subscription. Schedule a switch?`,
                        suggestedAction: 'switch_next',
                        currentSubscription
                    });
                }
            }
        }

        let trialEnd: number | undefined;
        if (billingCycle === 'next' && currentSubscription) {
            trialEnd = Math.floor(new Date(currentSubscription.currentPeriodEnd).getTime() / 1000);
        }

        const session = await paymentService.createCheckoutSession({
            userId,
            priceId,
            successUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true`,
            trialEnd
        });

        res.json({ success: true, data: session });
    } catch (error) {
        logger.error('Failed to create subscription session:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate subscription' });
    }
});

/**
 * @swagger
 * /api/v1/billing/cancel:
 *   post:
 *     summary: Cancel current subscription
 *     tags: [Billing]
 */
router.post('/cancel', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const subscription = await prisma.subscription.findUnique({ where: { userId } });

        if (!subscription || !subscription.stripeSubscriptionId) {
            return res.status(404).json({ success: false, message: 'No active subscription found' });
        }

        const success = await paymentService.cancelSubscription(subscription.stripeSubscriptionId);

        if (success) {
            await prisma.subscription.update({
                where: { userId },
                data: { cancelAtPeriodEnd: true }
            });
            res.json({ success: true, message: 'Subscription will be canceled at the end of the period' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
        }
    } catch (error) {
        logger.error('Failed to cancel subscription:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/portal:
 *   post:
 *     summary: Create Stripe Customer Portal session
 *     tags: [Billing]
 */
router.post('/portal', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);
        const url = await paymentService.createPortalSession(customerId, `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`);

        res.json({ success: true, data: { url } });
    } catch (error) {
        logger.error('Failed to create portal session:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/switch:
 *   post:
 *     summary: Switch to a different subscription plan
 *     tags: [Billing]
 */
router.post('/switch', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const { priceId, billingCycle } = req.body;
        const userId = req.user!.userId;

        if (!priceId) return res.status(400).json({ success: false, message: 'Price ID is required' });

        const currentSubscription = await prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });

        if (!currentSubscription || !isSubscriptionActive(currentSubscription)) {
            return res.status(400).json({ success: false, message: 'No active subscription found.' });
        }

        if (currentSubscription.plan?.stripePriceId === priceId && billingCycle !== 'next') {
            return res.status(400).json({ success: false, message: 'Already on this plan' });
        }

        if (!currentSubscription.stripeSubscriptionId) {
            return res.status(400).json({ success: false, message: 'No Stripe subscription ID found.' });
        }

        const forceSchedule = billingCycle === 'next';
        const success = await paymentService.switchSubscription(
            currentSubscription.stripeSubscriptionId,
            priceId,
            forceSchedule
        );

        if (success) {
            if (!forceSchedule) {
                const plans = await paymentService.getPricingPlans();
                const newPlan = plans.find(p => p.id === priceId);
                if (newPlan) {
                    await prisma.subscription.update({
                        where: { userId },
                        data: { planId: newPlan.id, status: 'active' }
                    });
                }
                res.json({ success: true, message: 'Subscription plan switched successfully' });
            } else {
                res.json({ success: true, message: 'Subscription plan switch scheduled' });
            }
        } else {
            res.status(500).json({ success: false, message: 'Failed to switch plan' });
        }
    } catch (error) {
        logger.error('Failed to switch subscription:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/payment-methods:
 *   get:
 *     summary: Get user's saved payment methods
 *     tags: [Billing]
 *   post:
 *     summary: Add a new payment method
 *     tags: [Billing]
 */
router.get('/payment-methods', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);
        const paymentMethods = await paymentService.getPaymentMethods(customerId);
        res.json({ success: true, data: paymentMethods });
    } catch (error) {
        logger.error('Failed to get payment methods:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.post('/payment-methods', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const email = req.user!.email;
        const { successUrl, cancelUrl } = req.body;

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const finalSuccessUrl = successUrl || `${baseUrl}/billing?success=true`;
        const finalCancelUrl = cancelUrl || `${baseUrl}/billing?canceled=true`;

        const result = await paymentService.createSetupSession(userId, email, finalSuccessUrl, finalCancelUrl);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Failed to create setup session:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/payment-methods/{id}:
 *   delete:
 *     summary: Delete a payment method
 *     tags: [Billing]
 */
router.delete('/payment-methods/:id', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const success = await paymentService.deletePaymentMethod(id);
        if (success) {
            res.json({ success: true, message: 'Payment method removed successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to remove payment method' });
        }
    } catch (error) {
        logger.error('Failed to delete payment method:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/invoices:
 *   get:
 *     summary: Get user invoices
 *     tags: [Billing]
 */
router.get('/invoices', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);
        const invoices = await paymentService.getInvoices(customerId);
        res.json({ success: true, data: invoices });
    } catch (error) {
        logger.error('Failed to get invoices:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/admin/config:
 *   patch:
 *     summary: Update billing configuration (Admin only)
 *     tags: [Billing]
 */
router.patch('/admin/config', authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { stripeSecretKey, paypalClientId } = req.body;
        if (stripeSecretKey) await systemConfigService.set('STRIPE_SECRET_KEY', stripeSecretKey, true);
        if (paypalClientId) await systemConfigService.set('PAYPAL_CLIENT_ID', paypalClientId, false);

        await paymentService.reloadConfiguration();
        res.json({ success: true, message: 'Billing configuration updated successfully' });
    } catch (error) {
        logger.error('Failed to update billing configuration:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/paypal/subscribe:
 *   post:
 *     summary: Create PayPal subscription
 *     tags: [Billing]
 */
router.post('/paypal/subscribe', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
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

        if (result) {
            res.json({ success: true, data: result });
        } else {
            res.status(500).json({ success: false, message: 'Failed to create PayPal payment' });
        }
    } catch (error) {
        logger.error('Failed to create PayPal subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate PayPal subscription' });
    }
});

/**
 * @swagger
 * /api/v1/billing/paypal/success:
 *   get:
 *     summary: Handle PayPal payment success
 *     tags: [Billing]
 */
router.get('/paypal/success', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const { paymentId, PayerID } = req.query;
        const userId = req.user!.userId;

        if (!paymentId || !PayerID) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?error=missing_params`);
        }

        const success = await paymentService.executePayPalPayment(paymentId as string, PayerID as string);

        if (success) {
            // Update subscription in database
            const subscription = await prisma.subscription.upsert({
                where: { userId },
                update: {
                    status: 'active',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                },
                create: {
                    userId,
                    planId: 'price_pro_monthly', // Default to pro plan
                    status: 'active',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });

            // Create payment record
            await prisma.payment.create({
                data: {
                    subscriptionId: subscription.id,
                    amount: 29.00, // Should be dynamic based on plan
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
router.get('/paypal/cancel', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true&payment=paypal`);
});

/**
 * @swagger
 * /api/v1/billing/webhook:
 *   post:
 *     summary: Stripe Webhook handler
 *     tags: [Billing]
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).send('Webhook Error: Missing signature');

    try {
        const event = paymentService.verifyWebhookSignature(req.body, sig as string);
        if (event) await paymentService.handleWebhook(event);
        res.json({ received: true });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Webhook Error:', errorMessage);
        res.status(400).send(`Webhook Error: ${errorMessage}`);
    }
});

export default router;
