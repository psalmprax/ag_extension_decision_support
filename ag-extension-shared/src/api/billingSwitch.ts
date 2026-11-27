/**
 * Whether anyone can pay. Off while pricing is being decided.
 *
 * Off means: the server refuses every request that would start a payment (new plans,
 * plan switches, cards, PayPal, M-Pesa, manual payment submissions), and the app hides
 * Billing, upgrade buttons and prices. Locked features then say "Ask us for access", and
 * an administrator unlocks them per account in User management (service grants) or with
 * a voucher. Existing subscribers can still cancel or manage their subscription, and
 * payment-provider webhooks keep working.
 *
 * To turn billing back on, set this to true and deploy.
 */
export const BILLING_ENABLED = false;

/** Where people ask for access while billing is off. */
export const ACCESS_CONTACT_EMAIL = 'info@gpfed.com';
