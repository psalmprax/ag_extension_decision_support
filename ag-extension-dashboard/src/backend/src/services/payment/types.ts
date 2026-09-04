import Stripe from 'stripe';

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function productFeatures(product: Stripe.Product | Stripe.DeletedProduct): string[] {
    const raw = (product as Stripe.Product & { features?: unknown }).features;
    return Array.isArray(raw) ? raw.filter((f): f is string => typeof f === 'string') : [];
}

export interface CreateCheckoutSessionParams {
    userId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialEnd?: number; // timestamp in seconds
}

export interface CreatePaymentIntentParams {
    userId: string;
    amount: number; // in cents
    currency: string;
    metadata?: Record<string, string>;
}

export interface InvoiceSummary {
    id: string;
    amount_paid: number;
    currency: string;
    status: string;
    created: number;
    invoice_pdf: string;
}

export interface StripeSubscription {
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
