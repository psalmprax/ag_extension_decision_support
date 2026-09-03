import { Router } from 'express';
import { paymentService } from '../../services/paymentService';
import { getPrisma } from '../../services/prismaService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

const prisma = getPrisma();

const errorStatusMap: Record<string, number> = {
    'PAYMENT_GATEWAY_NOT_CONFIGURED': 200,
    'STRIPE_ERROR': 402,
    'PAYPAL_ERROR': 402,
    'ACTIVE_SUBSCRIPTION_EXISTS': 409,
    'ALREADY_SUBSCRIBED': 400
};

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
router.get('/payment-methods', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);

        if (!customerId) {
            return res.status(errorStatusMap['PAYMENT_GATEWAY_NOT_CONFIGURED'] || 200).json({
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required to list payment methods'
            });
        }

        const result = await paymentService.getPaymentMethods(customerId);
        
        if (!result.success) {
            return res.status(errorStatusMap[result.errorCode as string] || 400).json({
                success: false,
                errorCode: result.errorCode,
                message: result.message
            });
        }
        
        res.json({ success: true, data: result.data });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'STRIPE_CONFIG_REQUIRED') {
            return res.status(400).json({
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required'
            });
        }
        logger.error('Failed to get payment methods:', error);
        safeError(res, 500, 'Internal server error');
    }
});

router.post('/payment-methods', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const email = req.user!.email;
        const { successUrl, cancelUrl } = req.body;

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const finalSuccessUrl = successUrl || `${baseUrl}/billing?success=true`;
        const finalCancelUrl = cancelUrl || `${baseUrl}/billing?canceled=true`;

        const result = await paymentService.createSetupSession(userId, email, finalSuccessUrl, finalCancelUrl);
        
        if (!result.success) {
            return res.status(errorStatusMap[result.errorCode as string] || 400).json({
                success: false,
                errorCode: result.errorCode,
                message: result.message
            });
        }
        
        res.json({ success: true, data: { url: result.url } });
    } catch (error) {
        logger.error('Failed to create setup session:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/payment-methods/{id}:
 *   delete:
 *     summary: Delete a payment method
 *     tags: [Billing]
 */
router.delete('/payment-methods/:id', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const success = await paymentService.deletePaymentMethod(id);
        if (success) {
            res.json({ success: true, message: 'Payment method removed successfully' });
        } else {
            safeError(res, 500, 'Failed to remove payment method');
        }
    } catch (error) {
        logger.error('Failed to delete payment method:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/invoices:
 *   get:
 *     summary: Get user invoices
 *     tags: [Billing]
 */
router.get('/invoices', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const customerId = await paymentService.getOrCreateCustomer(userId, user.email);
        
        if (!customerId) {
            return res.status(errorStatusMap['PAYMENT_GATEWAY_NOT_CONFIGURED'] || 200).json({
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required to fetch invoices'
            });
        }

        const result = await paymentService.getInvoices(customerId);
        
        if (!result.success) {
            return res.status(errorStatusMap[result.errorCode as string] || 400).json({
                success: false,
                errorCode: result.errorCode,
                message: result.message
            });
        }
        
        res.json({ success: true, data: result.data });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'STRIPE_CONFIG_REQUIRED') {
            return res.status(400).json({
                success: false,
                errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
                message: 'Stripe configuration required'
            });
        }
        logger.error('Failed to get invoices:', error);
        safeError(res, 500, 'Internal server error');
    }
});

export default router;
