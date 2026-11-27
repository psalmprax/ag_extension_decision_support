import { Router } from 'express';
import { idempotencyMiddleware } from '../../middleware/idempotencyMiddleware';
import { paymentService } from '../../services/paymentService';
import { logger } from '../../utils/logger';
import subscriptionRouter from './subscription';
import paymentMethodsRouter from './paymentMethods';
import analyticsRouter from './analytics';
import paypalRouter from './paypal';
import paypalWebhookRouter from './paypalWebhook';
import voucherRouter from './voucher';
import transactionsRouter from './transactions';
import webhookRouter from './webhook';
import mpesaRouter from './mpesa';
import { ACCESS_CONTACT_EMAIL, BILLING_ENABLED } from '@/shared-api/billingSwitch';

const router = Router();

// PayPal webhooks are verified by PayPal's own signature service and must never be
// replayed from (or cached in) the idempotency store, so they mount first.
router.use(paypalWebhookRouter);

// While billing is off (shared billingSwitch), nothing may start a payment. Cancelling,
// the customer portal, webhooks, vouchers and admin tools keep working.
const STARTS_A_PAYMENT = [
    /^\/subscribe$/, /^\/switch$/, /^\/paypal\/subscribe$/, /^\/paypal\/subscription$/,
    /^\/mpesa\/stk-push$/, /^\/transaction\/submit$/, /^\/payment-methods$/,
];

export function refusedWhileBillingOff(method: string, path: string, enabled = BILLING_ENABLED): boolean {
    return !enabled && method === 'POST' && STARTS_A_PAYMENT.some(pattern => pattern.test(path));
}

router.use((req, res, next) => {
    if (!refusedWhileBillingOff(req.method, req.path)) return next();
    res.status(403).json({
        success: false,
        code: 'BILLING_DISABLED',
        error: `Payments are switched off while pricing is decided. Email ${ACCESS_CONTACT_EMAIL} to get access.`,
    });
});

// Idempotency protection: prevent double charges from mobile retransmissions.
// Applies to all POST/PUT/PATCH on billing (subscribe, checkout, paypal, etc.).
router.use(idempotencyMiddleware);

// Gateway clients initialize asynchronously at process start. Hold every billing
// request until that settles so a cold start cannot read a half-initialized service
// and report the gateway as unconfigured while it is still connecting.
router.use(async (_req, _res, next) => {
    try {
        await paymentService.whenReady();
    } catch (error) {
        logger.error('Payment gateway readiness check failed:', error);
    }
    next();
});

router.use(subscriptionRouter);
router.use(paymentMethodsRouter);
router.use(analyticsRouter);
router.use(paypalRouter);
router.use(voucherRouter);
router.use(transactionsRouter);
router.use(webhookRouter);
router.use('/mpesa', mpesaRouter);

export default router;
