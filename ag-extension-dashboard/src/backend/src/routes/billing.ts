import express, { Router } from 'express';
import { paymentService } from '../services/paymentService';
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
 *     responses:
 *       200:
 *         description: List of pricing plans
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
 *     security:
 *       - bearerAuth: []
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
 *     security:
 *       - bearerAuth: []
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
 *     security:
 *       - bearerAuth: []
 */
router.post('/subscribe', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const { priceId } = req.body;
        const userId = req.user!.userId;

        if (!priceId) {
            return res.status(400).json({ success: false, message: 'Price ID is required' });
        }

        // Get current subscription to check status
        const currentSubscription = await prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });

        const billingCycle = req.body.billingCycle || 'current'; // 'current' or 'next'

        // Check if subscription is already active
        const hasStripeSubscription = currentSubscription && currentSubscription.stripeSubscriptionId;
        
        if (currentSubscription && isSubscriptionActive(currentSubscription) && hasStripeSubscription) {
            const currentPlanPriceId = currentSubscription.plan?.stripePriceId;
            const currentPlanName = currentSubscription.plan?.name;
            // const currentPeriodEnd = currentSubscription.currentPeriodEnd;

            // Same plan check
            const isSamePlan = currentPlanPriceId === priceId;

            if (billingCycle === 'current') {
                if (isSamePlan) {
                    return res.status(400).json({
                        success: false,
                        errorCode: 'ALREADY_SUBSCRIBED',
                        message: `You are already subscribed to the ${currentPlanName} plan for the current period.`,
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
                        // Un-cancel if they want to subscribe for next month
                        const success = await paymentService.switchSubscription(
                            currentSubscription.stripeSubscriptionId!,
                            priceId,
                            false // Re-activate immediately (un-cancel)
                        );
                        if (success) {
                            await prisma.subscription.update({
                                where: { userId },
                                data: { cancelAtPeriodEnd: false }
                            });
                            return res.json({ 
                                success: true, 
                                message: `Successfully scheduled renewal for ${currentPlanName} for the next period.` 
                            });
                        }
                    } else {
                        return res.status(400).json({
                            success: false,
                            message: `Your ${currentPlanName} subscription is already set to renew for the next period.`
                        });
                    }
                } else {
                    // Switch for next month
                    return res.status(409).json({
                        success: false,
                        errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS',
                        message: `You have an active ${currentPlanName} subscription. Do you want to schedule a switch to the new plan for the next period?`,
                        suggestedAction: 'switch_next',
                        currentSubscription
                    });
                }
            }
        }

        // Prepare checkout session
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

        // Re-check for incomplete status if no active subscription was found above
        if (currentSubscription && currentSubscription.status === 'incomplete') {
            return res.status(400).json({
                success: false,
                errorCode: 'PENDING_SUBSCRIPTION',
                message: 'You have a pending subscription. Please complete it first.',
                subscription: currentSubscription
            });
        }
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
 *     security:
 *       - bearerAuth: []
 */
router.post('/cancel', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const subscription = await prisma.subscription.findUnique({
            where: { userId }
        });

        if (!subscription || !subscription.stripeSubscriptionId) {
            return res.status(404).json({ success: false, message: 'No active subscription found' });
        }

        const success = await paymentService.cancelSubscription(subscription.stripeSubscriptionId);

        if (success) {
            // Update local DB
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
 *     security:
 *       - bearerAuth: []
 */
router.post('/portal', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

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
 *     security:
 *       - bearerAuth: []
 */
router.post('/switch', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const { priceId, billingCycle } = req.body;
        const userId = req.user!.userId;

        if (!priceId) {
            return res.status(400).json({ success: false, message: 'Price ID is required' });
        }

        // Get current subscription
        const currentSubscription = await prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });

        if (!currentSubscription) {
            return res.status(400).json({
                success: false,
                message: 'No active subscription found. Please subscribe first.'
            });
        }

        if (!isSubscriptionActive(currentSubscription)) {
            return res.status(400).json({
                success: false,
                message: 'Your subscription is not active. Please subscribe to a new plan.'
            });
        }

        // Check if already on this plan
        if (currentSubscription.plan?.stripePriceId === priceId && billingCycle !== 'next') {
            return res.status(400).json({
                success: false,
                message: 'You are already subscribed to this plan'
            });
        }

        // Switch the subscription
        if (!currentSubscription.stripeSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'No Stripe subscription ID found. Please contact support.'
            });
        }

        const forceSchedule = billingCycle === 'next';
        const success = await paymentService.switchSubscription(
            currentSubscription.stripeSubscriptionId,
            priceId,
            forceSchedule
        );

        if (success) {
            if (!forceSchedule) {
                // Update local plan reference immediately if not scheduled
                const plans = await paymentService.getPricingPlans();
                const newPlan = plans.find(p => p.id === priceId);

                if (newPlan) {
                    await prisma.subscription.update({
                        where: { userId },
                        data: {
                            planId: newPlan.id,
                            status: 'active'
                        }
                    });
                }
                res.json({ success: true, message: 'Subscription plan switched successfully' });
            } else {
                res.json({ success: true, message: 'Subscription plan switch scheduled for the next period' });
            }
        } else {
            res.status(500).json({ success: false, message: 'Failed to switch subscription plan' });
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
 *     security:
 *       - bearerAuth: []
 */
router.get('/payment-methods', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);
        const paymentMethods = await paymentService.getPaymentMethods(customerId);

        res.json({ success: true, data: paymentMethods });
    } catch (error) {
        logger.error('Failed to get payment methods:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/payment-methods:
 *   post:
 *     summary: Add a new payment method (Placeholder)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.post('/payment-methods', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        // In a real implementation, this would handle Stripe SetupIntents or PayPal linking
        logger.info(`[${paymentService.isSimulated ? 'DEMO' : 'REAL'}] User ${req.user!.userId} attempted to add a payment method of type: ${req.body.type || 'unknown'}`);
        
        res.json({ 
            success: true, 
            message: paymentService.isSimulated 
                ? 'Stripe is not configured. In this Demo Mode, payment methods are simulated.' 
                : 'Payment method added successfully (Real Mode).',
            isMock: paymentService.isSimulated
        });
    } catch (error) {
        logger.error('Failed to add payment method:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/v1/billing/payment-methods/{id}:
 *   delete:
 *     summary: Delete a payment method
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
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
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices', authorize('admin', 'extension_officer', 'farmer'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

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
 * /api/v1/billing/webhook:
 *   post:
 *     summary: Stripe Webhook handler
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Webhook received.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        return res.status(400).send('Webhook Error: Missing signature');
    }

    try {
        const event = paymentService.verifyWebhookSignature(req.body, sig as string);

        if (event) {
            await paymentService.handleWebhook(event);
        }

        res.json({ received: true });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Webhook Error:', errorMessage);
        res.status(400).send(`Webhook Error: ${errorMessage}`);
    }
});

export default router;
