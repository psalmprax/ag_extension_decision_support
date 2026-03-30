import Stripe from 'stripe';
import paypal from 'paypal-rest-sdk';

import { logger } from '../utils/logger';
import { systemConfigService } from './systemConfigService';

export interface CreateCheckoutSessionParams {
    userId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialEnd?: number; // timestamp in seconds
}

export interface CreateSubscriptionParams {
    userId: string;
    email: string;
    priceId: string;
    paymentMethodId: string;
}

export interface CreatePaymentIntentParams {
    userId: string;
    amount: number; // in cents
    currency: string;
    metadata?: Record<string, string>;
}

interface StripeSubscription {
    id: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    items: {
        data: Array<{
            id: string;
            price: {
                id: string;
                nickname?: string;
            };
        }>;
    };
}

class PaymentService {
    private stripe: Stripe | null = null;
    private paypalConfigured: boolean = false;
    public isSimulated: boolean = true;

    constructor() {
        this.initializeStripe();
        this.initializePayPal();
    }

    private async initializeStripe() {
        const stripeKey = await systemConfigService.getStripeKey();

        // Check if key is valid (must be real Stripe key, not placeholder)
        const isValidKey = stripeKey &&
            stripeKey.startsWith('sk_') &&
            !stripeKey.includes('your_') &&
            stripeKey.length > 20;

        if (isValidKey) {
            try {
                this.stripe = new Stripe(stripeKey, {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    apiVersion: '2024-12-18.acacia' as any,
                });
                this.isSimulated = false;
                logger.info('Stripe payment service initialized (Real Mode)');
            } catch (error) {
                logger.warn('Failed to initialize Stripe with provided key - payments will be simulated (Demo Mode):', error);
                this.stripe = null;
                this.isSimulated = true;
            }
        } else {
            const reason = !stripeKey ? 'Key missing' : 'Key is placeholder/invalid';
            logger.warn(`Stripe not configured (${reason}) - payments will be simulated (Demo Mode)`);
            this.stripe = null;
            this.isSimulated = true;
        }
    }

    // PayPal initialization
    private async initializePayPal() {
        const paypalClientId = await systemConfigService.getPayPalKey();
        const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

        if (paypalClientId && paypalClientSecret) {
            try {
                paypal.configure({
                    mode: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
                    client_id: paypalClientId,
                    client_secret: paypalClientSecret
                });
                this.paypalConfigured = true;
                logger.info('PayPal payment service initialized');
            } catch (error) {
                logger.warn('Failed to initialize PayPal:', error);
                this.paypalConfigured = false;
            }
        } else {
            logger.warn('PayPal not configured - PayPal payments unavailable');
            this.paypalConfigured = false;
        }
    }

    // Explicitly reload keys (useful after admin updates)
    async reloadConfiguration() {
        await this.initializeStripe();
        await this.initializePayPal();
    }

    public isStripeConfigured(): boolean {
        return this.stripe !== null;
    }

    public isPayPalConfigured(): boolean {
        return this.paypalConfigured;
    }

    private appendQueryParam(url: string, key: string, value: string): string {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${key}=${encodeURIComponent(value)}`;
    }

    // Create a checkout session for subscription
    async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{
        success: boolean;
        sessionId?: string;
        url?: string;
        errorCode?: string;
        message?: string;
    }> {
        if (!this.stripe) {
            logger.warn(`Stripe not configured. Card checkout unavailable for user ${params.userId}.`);
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe (Credit Card) payment gateway is not configured. Please contact your administrator or set your keys in the Admin Settings.'
            };
        }

        try {
            const session = await this.stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: params.priceId,
                        quantity: 1,
                    },
                ],
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
                subscription_data: params.trialEnd ? {
                    trial_end: params.trialEnd,
                } : undefined,
                metadata: {
                    userId: params.userId,
                },
            });

            return {
                success: true,
                sessionId: session.id,
                url: session.url!,
            };
        } catch (error: any) {
            logger.error('Failed to create Stripe checkout session:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to initiate Stripe checkout'
            };
        }
    }

    // Create a setup session for adding payment methods
    async createSetupSession(userId: string, email: string, successUrl: string, cancelUrl: string): Promise<{
        success: boolean;
        url?: string;
        errorCode?: string;
        message?: string;
    }> {
        if (!this.stripe) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required for payment method setup'
            };
        }

        try {
            const customerId = await this.getOrCreateCustomer(userId, email);

            const session = await this.stripe.checkout.sessions.create({
                mode: 'setup',
                customer: customerId,
                payment_method_types: ['card'],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    userId,
                },
            });

            return {
                success: true,
                url: session.url!,
            };
        } catch (error: any) {
            logger.error('Failed to create Stripe setup session:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to initiate payment method setup'
            };
        }
    }

    // Create a payment intent for one-time payments
    async createPaymentIntent(params: CreatePaymentIntentParams): Promise<{
        success: boolean;
        clientSecret?: string;
        paymentIntentId?: string;
        errorCode?: string;
        message?: string;
    }> {
        if (!this.stripe) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required for payments'
            };
        }

        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: params.amount,
                currency: params.currency || 'usd',
                metadata: {
                    userId: params.userId,
                    ...params.metadata,
                },
            });

            return {
                success: true,
                clientSecret: paymentIntent.client_secret!,
                paymentIntentId: paymentIntent.id,
            };
        } catch (error: any) {
            logger.error('Failed to create payment intent:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to initiate payment intent'
            };
        }
    }

    // Create or get Stripe customer
    async getOrCreateCustomer(userId: string, email: string): Promise<string> {
        if (!this.stripe) {
            throw new Error('STRIPE_CONFIG_REQUIRED');
        }

        // Search for existing customer
        const existing = await this.stripe.customers.list({
            email,
            limit: 1,
        });

        if (existing.data.length > 0) {
            return existing.data[0].id;
        }

        // Create new customer
        const customer = await this.stripe.customers.create({
            email,
            metadata: {
                userId,
            },
        });

        return customer.id;
    }

    // Cancel subscription
    async cancelSubscription(subscriptionId: string): Promise<boolean> {
        if (!this.stripe) {
            logger.info(`[MOCK] Cancelled subscription: ${subscriptionId}`);
            return true;
        }

        try {
            await this.stripe.subscriptions.cancel(subscriptionId);
            return true;
        } catch (error) {
            logger.error('Failed to cancel subscription:', error);
            return false;
        }
    }

    // Get subscription details
    async getSubscription(subscriptionId: string): Promise<{
        success: boolean;
        status?: string;
        currentPeriodEnd?: number;
        planName?: string;
        errorCode?: string;
        message?: string;
    } | null> {
        if (!this.stripe) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required to check subscription status'
            };
        }

        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            const price = subscription.items.data[0].price;

            return {
                success: true,
                status: subscription.status,
                currentPeriodEnd: (subscription as unknown as StripeSubscription).current_period_end * 1000,
                planName: price.nickname || 'Subscription',
            };
        } catch (error: any) {
            logger.error('Failed to get subscription:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to retrieve subscription details'
            };
        }
    }

    // Switch subscription to a different plan
    async switchSubscription(subscriptionId: string, newPriceId: string, scheduleNextPeriod: boolean = false): Promise<boolean> {
        if (!this.stripe) {
            logger.info(`[MOCK] Switched subscription ${subscriptionId} to price ${newPriceId} (scheduled: ${scheduleNextPeriod})`);
            return true;
        }

        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            const itemId = subscription.items.data[0].id;

            if (scheduleNextPeriod) {
                // Use subscription schedules to cue the change for the next period
                const schedule = await this.stripe.subscriptionSchedules.create({
                    from_subscription: subscriptionId,
                });

                await this.stripe.subscriptionSchedules.update(schedule.id, {
                    end_behavior: 'release',
                    phases: [
                        {
                            items: [{ price: (subscription.items.data[0].price as Stripe.Price).id, quantity: 1 }],
                            end_date: (subscription as unknown as StripeSubscription).current_period_end,
                        },
                        {
                            items: [{ price: newPriceId, quantity: 1 }],
                            start_date: (subscription as unknown as StripeSubscription).current_period_end,
                        }
                    ]
                });
                logger.info(`Scheduled subscription change for ${subscriptionId} to ${newPriceId} at ${(subscription as unknown as StripeSubscription).current_period_end}`);
            } else {
                // Immediate switch
                await this.stripe.subscriptions.update(subscriptionId, {
                    items: [
                        {
                            id: itemId,
                            price: newPriceId,
                        },
                    ],
                    proration_behavior: 'always_invoice',
                });
            }

            return true;
        } catch (error) {
            logger.error('Failed to switch subscription:', error);
            return false;
        }
    }

    // Get customer's payment methods
    async getPaymentMethods(customerId: string): Promise<{
        success: boolean;
        data?: Array<{
            id: string;
            type: string;
            card?: {
                brand: string;
                last4: string;
                expMonth: number;
                expYear: number;
            };
        }>;
        errorCode?: string;
        message?: string;
    }> {
        if (!this.stripe) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required to list payment methods'
            };
        }

        try {
            const paymentMethods = await this.stripe.paymentMethods.list({
                customer: customerId,
                type: 'card',
            });

            const data = paymentMethods.data.map(pm => ({
                id: pm.id,
                type: pm.type,
                card: pm.card ? {
                    brand: pm.card.brand,
                    last4: pm.card.last4,
                    expMonth: pm.card.exp_month,
                    expYear: pm.card.exp_year,
                } : undefined,
            }));

            return { success: true, data };
        } catch (error: any) {
            logger.error('Failed to get payment methods:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to fetch payment methods'
            };
        }
    }

    // Delete payment method
    async deletePaymentMethod(paymentMethodId: string): Promise<boolean> {
        if (!this.stripe) {
            logger.info(`[MOCK] Deleted payment method: ${paymentMethodId}`);
            return true;
        }

        try {
            await this.stripe.paymentMethods.detach(paymentMethodId);
            return true;
        } catch (error) {
            logger.error('Failed to delete payment method:', error);
            return false;
        }
    }

    // Handle Stripe webhooks
    async handleWebhook(event: Stripe.Event): Promise<boolean> {
        const prisma = (await import('./prismaService')).getPrisma();

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    const userId = session.metadata?.userId;
                    const stripeSubscriptionId = session.subscription as string;

                    if (!userId || !stripeSubscriptionId) break;

                    const subscription = await this.stripe!.subscriptions.retrieve(stripeSubscriptionId);
                    const priceId = subscription.items.data[0].price.id;

                    const plan = await prisma.subscriptionPlan.findFirst({
                        where: { stripePriceId: priceId }
                    });

                    if (plan) {
                        await prisma.subscription.upsert({
                            where: { userId },
                            update: {
                                planId: plan.id,
                                stripeSubscriptionId,
                                status: subscription.status as string,
                                currentPeriodStart: new Date((subscription as unknown as StripeSubscription).current_period_start * 1000),
                                currentPeriodEnd: new Date((subscription as unknown as StripeSubscription).current_period_end * 1000),
                                cancelAtPeriodEnd: subscription.cancel_at_period_end as boolean,
                            },
                            create: {
                                userId,
                                planId: plan.id,
                                stripeSubscriptionId,
                                status: subscription.status as string,
                                currentPeriodStart: new Date((subscription as unknown as StripeSubscription).current_period_start * 1000),
                                currentPeriodEnd: new Date((subscription as unknown as StripeSubscription).current_period_end * 1000),
                            }
                        });
                        logger.info(`Subscription created/updated for user ${userId} via checkout`);
                    }
                    break;
                }

                case 'invoice.paid': {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const invoice = event.data.object as any;
                    const stripeSubscriptionId = invoice.subscription as string;

                    if (stripeSubscriptionId) {
                        const subscription = await this.stripe!.subscriptions.retrieve(stripeSubscriptionId);

                        await prisma.subscription.updateMany({
                            where: { stripeSubscriptionId },
                            data: {
                                status: 'active',
                                currentPeriodStart: new Date((subscription as unknown as StripeSubscription).current_period_start * 1000),
                                currentPeriodEnd: new Date((subscription as unknown as StripeSubscription).current_period_end * 1000),
                            }
                        });

                        // Reset usage for the new period
                        const subRecord = await prisma.subscription.findFirst({
                            where: { stripeSubscriptionId }
                        });
                        if (subRecord) {
                            const { usageService } = await import('./usageService');
                            await usageService.resetUsage(subRecord.id);
                        }

                        logger.info(`Invoice paid and usage reset for subscription ${stripeSubscriptionId}`);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object as Stripe.Subscription;
                    const stripeSubscriptionId = subscription.id;

                    await prisma.subscription.updateMany({
                        where: { stripeSubscriptionId },
                        data: { status: 'canceled' }
                    });
                    logger.info(`Subscription ${stripeSubscriptionId} marked as canceled`);
                    break;
                }

                case 'customer.subscription.updated': {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const subscription = event.data.object as any;
                    const stripeSubscriptionId = subscription.id;
                    const priceId = subscription.items.data[0].price.id;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const plan = await (prisma.subscriptionPlan as any).findFirst({
                        where: { stripePriceId: priceId }
                    });

                    if (plan) {
                        await prisma.subscription.updateMany({
                            where: { stripeSubscriptionId },
                            data: {
                                planId: plan.id,
                                status: subscription.status as string,
                                currentPeriodEnd: new Date((subscription as unknown as StripeSubscription).current_period_end * 1000),
                                cancelAtPeriodEnd: subscription.cancel_at_period_end as boolean,
                            }
                        });
                        logger.info(`Subscription ${stripeSubscriptionId} updated to plan ${plan.name}`);
                    }
                    break;
                }
            }
            return true;
        } catch (error) {
            logger.error('Error handling Stripe webhook:', error);
            return false;
        }
    }

    // Create billing portal session
    async createPortalSession(customerId: string, returnUrl: string): Promise<{ success: boolean; url?: string; errorCode?: string; message?: string }> {
        if (!this.stripe) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required for billing portal access'
            };
        }

        try {
            const session = await this.stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });

            return { success: true, url: session.url };
        } catch (error: any) {
            logger.error('Failed to create portal session:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to initiate billing portal'
            };
        }
    }

    // Verify webhook signature
    verifyWebhookSignature(payload: string, signature: string): Stripe.Event | null {
        if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
            return null;
        }

        try {
            return this.stripe.webhooks.constructEvent(
                payload,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (error) {
            logger.error('Webhook signature verification failed:', error);
            return null;
        }
    }

    // Get available pricing plans
    async getPricingPlans(): Promise<Array<{
        id: string;
        name: string;
        price: number;
        interval: string;
        features: string[];
    }>> {
        if (!this.stripe) {
            // Return mock plans with translation keys
            return [
                {
                    id: 'price_free',
                    name: 'Free',
                    price: 0,
                    interval: 'month',
                    features: [
                        'plan_feature_up_to_10_farmers',
                        'plan_feature_basic_analytics',
                        'plan_feature_email_support'
                    ],
                },
                {
                    id: 'price_pro_monthly',
                    name: 'Pro',
                    price: 2900,
                    interval: 'month',
                    features: [
                        'plan_feature_unlimited_farmers',
                        'plan_feature_advanced_analytics',
                        'plan_feature_priority_support',
                        'plan_feature_ai_assistant'
                    ],
                },
                {
                    id: 'price_enterprise',
                    name: 'Enterprise',
                    price: 9900,
                    interval: 'month',
                    features: [
                        'plan_feature_everything_in_pro',
                        'plan_feature_custom_integrations',
                        'plan_feature_dedicated_support',
                        'plan_feature_sla'
                    ],
                },
            ];
        }

        try {
            const prices = await this.stripe.prices.list({
                active: true,
                expand: ['data.product'],
                type: 'recurring',
            });

            return prices.data.map((price) => ({
                id: price.id,
                name: (price.product as Stripe.Product).name || 'Plan',
                price: price.unit_amount || 0,
                interval: price.recurring?.interval || 'month',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                features: ((price.product as any).features) || [],
            }));
        } catch (error) {
            logger.error('Failed to get pricing plans:', error);
            return [];
        }
    }

    // Get invoices for a customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getInvoices(customerId: string): Promise<{
        success: boolean;
        data?: any[];
        errorCode?: string;
        message?: string;
    }> {
        if (!this.stripe) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required to fetch invoices'
            };
        }

        try {
            const invoices = await this.stripe.invoices.list({
                customer: customerId,
                limit: 10,
            });

            const data = invoices.data.map(inv => ({
                id: inv.id,
                amount_paid: inv.amount_paid,
                currency: inv.currency,
                status: inv.status as string,
                created: inv.created,
                invoice_pdf: inv.invoice_pdf as string
            }));

            return { success: true, data };
        } catch (error: any) {
            logger.error('Failed to fetch invoices:', error);
            return {
                success: false,
                errorCode: 'STRIPE_ERROR',
                message: error.message || 'Failed to retrieve invoice history'
            };
        }
    }

    // PayPal payment methods
    async createPayPalPayment(params: {
        userId: string;
        amount: number;
        currency: string;
        description: string;
        returnUrl: string;
        cancelUrl: string;
    }): Promise<{ success: boolean; paymentId?: string; approvalUrl?: string; errorCode?: string; message?: string } | null> {
        if (!this.paypalConfigured) {
            return {
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the Admin Vault.'
            };
        }

        return new Promise((resolve) => {
            const createPaymentJson = {
                intent: 'sale',
                payer: {
                    payment_method: 'paypal'
                },
                redirect_urls: {
                    return_url: params.returnUrl,
                    cancel_url: params.cancelUrl
                },
                transactions: [{
                    item_list: {
                        items: [{
                            name: params.description,
                            sku: 'subscription',
                            price: (params.amount / 100).toFixed(2),
                            currency: params.currency,
                            quantity: 1
                        }]
                    },
                    amount: {
                        currency: params.currency,
                        total: (params.amount / 100).toFixed(2)
                    },
                    description: params.description
                }]
            };

            paypal.payment.create(createPaymentJson, (error: any, payment: any) => {
                if (error) {
                    logger.error('PayPal payment creation failed:', error);
                    resolve({
                        success: false,
                        errorCode: 'PAYPAL_ERROR',
                        message: error.message || 'Failed to initiate PayPal payment'
                    });
                } else {
                    const approvalUrl = payment.links.find((link: any) => link.rel === 'approval_url').href;
                    resolve({
                        success: true,
                        paymentId: payment.id,
                        approvalUrl
                    });
                }
            });
        });
    }

    async executePayPalPayment(paymentId: string, payerId: string): Promise<boolean> {
        if (!this.paypalConfigured) {
            logger.info(`[MOCK] PayPal payment ${paymentId} executed for payer ${payerId}`);
            return true;
        }

        return new Promise((resolve) => {
            paypal.payment.execute(paymentId, { payer_id: payerId }, (error: any, payment: any) => {
                if (error) {
                    logger.error('PayPal payment execution failed:', error);
                    resolve(false);
                } else {
                    logger.info('PayPal payment executed successfully:', payment.id);
                    resolve(true);
                }
            });
        });
    }

}

export const paymentService = new PaymentService();
