/**
 * Whether anyone can pay. Off while pricing is being decided.
 *
 * Off means: the server refuses every request that would start a payment (new plans,
 * plan switches, cards, PayPal, M-Pesa, manual payment submissions), and the app hides
 * upgrade buttons and the "Plans & pricing" and "Payment methods" tabs. Billing itself is
 * shown only to admins and to accounts on a paid plan, who can still see invoices and
 * manage or cancel their subscription; provider webhooks keep working. Locked features
 * say "Ask us for access", and an administrator unlocks them per account in User
 * management (service grants).
 *
 * To turn billing back on, set this to true and deploy.
 */
export const BILLING_ENABLED = false;

/** Where people ask for access while billing is off. */
export const ACCESS_CONTACT_EMAIL = 'info@gpfed.com';
