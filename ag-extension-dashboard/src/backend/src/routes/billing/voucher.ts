import { Router } from 'express';
import { voucherService } from '../../services/voucherService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// =============================================
// VOUCHER ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/v1/billing/voucher/redeem:
 *   post:
 *     summary: Redeem a voucher code to activate a subscription
 *     tags: [Billing]
 */
router.post('/voucher/redeem', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res) => {
    try {
        const { code } = req.body;
        const userId = req.user!.userId;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ success: false, message: 'Voucher code is required.' });
        }

        const result = await voucherService.redeemVoucher(userId, code);
        if (result.success) {
            res.json({ success: true, message: result.message, data: { planName: result.planName } });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Voucher redemption failed:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @swagger
 * /api/v1/billing/voucher/generate:
 *   post:
 *     summary: Generate voucher codes for a plan (Admin only)
 *     tags: [Billing]
 */
router.post('/voucher/generate', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const { planId, count = 1, expiresInDays } = req.body;

        if (!planId) {
            return res.status(400).json({ success: false, message: 'Plan ID is required.' });
        }

        const result = await voucherService.generateVouchers(planId, Math.min(count, 100), expiresInDays);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Voucher generation failed:', error);
        safeError(res, 500, 'Failed to generate vouchers');
    }
});

/**
 * @swagger
 * /api/v1/billing/voucher/list:
 *   get:
 *     summary: List all vouchers (Admin only)
 *     tags: [Billing]
 */
router.get('/voucher/list', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const { planId, isRedeemed } = req.query;
        const vouchers = await voucherService.listVouchers({
            planId: planId as string | undefined,
            isRedeemed: isRedeemed !== undefined ? isRedeemed === 'true' : undefined,
        });
        res.json({ success: true, data: vouchers });
    } catch (error) {
        logger.error('Failed to list vouchers:', error);
        safeError(res, 500, 'Internal server error');
    }
});

export default router;
