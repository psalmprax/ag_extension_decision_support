import { Router } from 'express';
import { idempotencyMiddleware } from '../../middleware/idempotencyMiddleware';
import subscriptionRouter from './subscription';
import paymentMethodsRouter from './paymentMethods';
import analyticsRouter from './analytics';
import paypalRouter from './paypal';
import voucherRouter from './voucher';
import transactionsRouter from './transactions';
import webhookRouter from './webhook';

const router = Router();

// Idempotency protection: prevent double charges from mobile retransmissions.
// Applies to all POST/PUT/PATCH on billing (subscribe, checkout, paypal, etc.).
router.use(idempotencyMiddleware);

router.use(subscriptionRouter);
router.use(paymentMethodsRouter);
router.use(analyticsRouter);
router.use(paypalRouter);
router.use(voucherRouter);
router.use(transactionsRouter);
router.use(webhookRouter);

export default router;
