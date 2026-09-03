import express, { Router } from 'express';
import { paymentService } from '../../services/paymentService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/billing/webhook:
 *   post:
 *     summary: Stripe Webhook handler
 *     tags: [Billing]
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: express.Request, res: express.Response) => {
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
