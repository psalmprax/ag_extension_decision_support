import express, { Router } from 'express';
import { paymentService } from '../../services/paymentService';
import { getPrisma } from '../../services/prismaService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { usageService, FREE_TIER_LIMITS } from '../../services/usageService';
import { safeError } from '@/utils/safeResponse';

// Route-level subscription writes are local mirrors / complementary writes only.
// Stripe-driven subscription state is authoritative from the Stripe webhook handler
// in services/paymentService.ts (handleWebhook). See that file for the ownership contract.

const router = Router();

const prisma = getPrisma();

const errorStatusMap: Record<string, number> = {
    'PAYMENT_GATEWAY_NOT_CONFIGURED': 200,
    'STRIPE_ERROR': 402,
    'PAYPAL_ERROR': 402,
    'ACTIVE_SUBSCRIPTION_EXISTS': 409,
    'ALREADY_SUBSCRIBED': 400
};

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
/**
 * GET /api/v1/billing/quotas
 * The *enforced* per-plan limits (from subscription_plans.features) — the same
 * numbers usageService applies at request time. Public so pricing UIs never
 * hardcode quotas that drift from enforcement.
 */
router.get('/quotas', async (_req, res) => {
    try {
        const plans = await getPrisma().subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' },
            select: { id: true, name: true, price: true, currency: true, interval: true, features: true, stripePriceId: true },
        });
        const data = plans.map(p => {
            const f = (p.features ?? {}) as Record<string, unknown>;
            const isFree = Number(p.price) === 0 || p.name.toLowerCase() === 'free';
            const lim = (k: string, fallback: number) => (typeof f[k] === 'number' ? (f[k] as number) : fallback);
            return {
                id: p.id,
                stripePriceId: p.stripePriceId,
                name: p.name,
                price: Number(p.price),
                currency: p.currency,
                interval: p.interval,
                quotas: isFree ? { ...FREE_TIER_LIMITS } : {
                    smsLimit: lim('smsLimit', 500),
                    aiChatLimit: lim('aiChatLimit', 1000),
                    reportLimit: lim('reportLimit', 50),
                    aiVisionLimit: lim('aiVisionLimit', 100),
                    speechLimit: lim('speechLimit', 200),
                    whatsappLimit: lim('whatsappLimit', 500),
                    knowledgeDailyLimit: lim('knowledgeDailyLimit', -1),
                },
                enforcement: 'hard_limit',
            };
        });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Failed to get quotas:', error);
        safeError(res, 500, 'Failed to load plan quotas');
    }
});

router.get('/plans', async (req, res) => {
    try {
        const plans = await paymentService.getPricingPlans();
        res.json({ success: true, data: plans });
    } catch (error) {
        logger.error('Failed to get plans:', error);
        safeError(res, 500, 'Failed to retrieve pricing plans');
    }
});

/**
 * @swagger
 * /api/v1/billing/subscription:
 *   get:
 *     summary: Get current user subscription
 *     tags: [Billing]
 */
router.get('/subscription', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
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
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/usage:
 *   get:
 *     summary: Get user usage statistics
 *     tags: [Billing]
 */
router.get('/usage', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const usageData = await usageService.getUsageStatus(req.user!.userId);
        res.json({ success: true, data: usageData });
    } catch (error) {
        logger.error('Failed to get usage:', error);
        safeError(res, 500, 'Internal server error');
    }
});

interface SubscriptionWithPlan {
    stripeSubscriptionId: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | Date;
    plan?: {
        name?: string;
        stripePriceId: string | null;
    };
    [key: string]: unknown;
}

async function handleExistingSubscription(currentSubscription: SubscriptionWithPlan, priceId: string, billingCycle: string, res: express.Response, userId: string) {
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
        }
        return res.status(409).json({
            success: false,
            errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS',
            message: `You already have an active ${currentPlanName} subscription.`,
            suggestedAction: 'switch',
            currentSubscription
        });
    }

    if (billingCycle === 'next') {
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
            }
            return res.status(400).json({
                success: false,
                message: `Your ${currentPlanName} subscription is already set to renew.`
            });
        }
        return res.status(409).json({
            success: false,
            errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS',
            message: `You have an active ${currentPlanName} subscription. Schedule a switch?`,
            suggestedAction: 'switch_next',
            currentSubscription
        });
    }

    return null;
}

/**
 * @swagger
 * /api/v1/billing/subscribe:
 *   post:
 *     summary: Create a checkout session
 *     tags: [Billing]
 */
router.post('/subscribe', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
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
            const handled = await handleExistingSubscription(currentSubscription, priceId, billingCycle, res, userId);
            if (handled) return;
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

        if (!session.success) {
            return res.status(errorStatusMap[session.errorCode as string] || 400).json({
                success: false,
                errorCode: session.errorCode,
                message: session.message
            });
        }

        res.json({ success: true, data: session });
    } catch (error) {
        logger.error('Failed to create subscription session:', error);
        safeError(res, 500, 'Failed to initiate subscription');
    }
});

/**
 * @swagger
 * /api/v1/billing/cancel:
 *   post:
 *     summary: Cancel current subscription
 *     tags: [Billing]
 */
router.post('/cancel', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
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
            safeError(res, 500, 'Failed to cancel subscription');
        }
    } catch (error) {
        logger.error('Failed to cancel subscription:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/portal:
 *   post:
 *     summary: Create Stripe Customer Portal session
 *     tags: [Billing]
 */
router.post('/portal', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);
        
        if (!customerId) {
            return res.status(errorStatusMap['PAYMENT_GATEWAY_NOT_CONFIGURED'] || 200).json({
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required for billing portal access'
            });
        }

        const result = await paymentService.createPortalSession(customerId, `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`);

        if (!result.success) {
            return res.status(errorStatusMap[result.errorCode as string] || 400).json({
                success: false,
                errorCode: result.errorCode,
                message: result.message
            });
        }

        res.json({ success: true, data: { url: result.url } });
    } catch (error) {
        logger.error('Failed to create portal session:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/switch:
 *   post:
 *     summary: Switch to a different subscription plan
 *     tags: [Billing]
 */
router.post('/switch', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
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
            safeError(res, 500, 'Failed to switch plan');
        }
    } catch (error) {
        logger.error('Failed to switch subscription:', error);
        safeError(res, 500, 'Internal server error');
    }
});

export default router;
