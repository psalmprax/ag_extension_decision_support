import { Router } from 'express';
import { transactionService } from '../../services/transactionService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// =============================================
// TRANSACTION SUBMISSION ENDPOINTS (M-Pesa / Airtel / Bank)
// =============================================

/**
 * @swagger
 * /api/v1/billing/transaction/submit:
 *   post:
 *     summary: Submit a manual payment transaction for verification
 *     tags: [Billing]
 */
router.post('/transaction/submit', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const { planId, method, transactionId, amount, currency } = req.body;
        const userId = req.user!.userId;

        if (!planId || !method || !transactionId || !amount) {
            return res.status(400).json({ success: false, message: 'planId, method, transactionId, and amount are required.' });
        }

        const validMethods = ['mpesa', 'airtel', 'bank'];
        if (!validMethods.includes(method)) {
            return res.status(400).json({ success: false, message: `Invalid method. Must be one of: ${validMethods.join(', ')}` });
        }

        const result = await transactionService.submitTransaction({
            userId,
            planId,
            method,
            transactionId,
            amount: parseFloat(amount),
            currency,
        });

        if (result.success) {
            res.json({ success: true, message: result.message, data: { submissionId: result.submissionId } });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Transaction submission failed:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/transaction/my:
 *   get:
 *     summary: Get the current user's transaction submissions
 *     tags: [Billing]
 */
router.get('/transaction/my', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const submissions = await transactionService.getUserSubmissions(req.user!.userId);
        res.json({ success: true, data: submissions });
    } catch (error) {
        logger.error('Failed to get user submissions:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/transaction/list:
 *   get:
 *     summary: List all transaction submissions (Admin only)
 *     tags: [Billing]
 */
router.get('/transaction/list', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const { status } = req.query;
        const transactions = await transactionService.listTransactions({
            status: status as 'pending' | 'verified' | 'rejected' | undefined,
        });
        res.json({ success: true, data: transactions });
    } catch (error) {
        logger.error('Failed to list transactions:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/transaction/verify/{id}:
 *   post:
 *     summary: Verify (approve) a transaction submission (Admin only)
 *     tags: [Billing]
 */
router.post('/transaction/verify/:id', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user!.userId;
        const result = await transactionService.verifyTransaction(id, adminUserId);

        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Transaction verification failed:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/transaction/reject/{id}:
 *   post:
 *     summary: Reject a transaction submission (Admin only)
 *     tags: [Billing]
 */
router.post('/transaction/reject/:id', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminUserId = req.user!.userId;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }

        const result = await transactionService.rejectTransaction(id, adminUserId, reason);
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Transaction rejection failed:', error);
        safeError(res, 500, 'Internal server error');
    }
});

export default router;
