import { Router } from 'express';
import { paymentService } from '../../services/paymentService';
import { systemConfigService } from '../../services/systemConfigService';
import { paymentAnalyticsService } from '../../services/paymentAnalyticsService';
import { logger } from '../../utils/logger';
import { authorize, AuthRequest } from '../../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/**
 * @swagger
 * /api/v1/billing/analytics/dashboard:
 *   get:
 *     summary: Get comprehensive payment analytics dashboard data (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/dashboard', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const analytics = await paymentAnalyticsService.getAnalyticsDashboard();
        res.json({ success: true, data: analytics });
    } catch (error) {
        logger.error('Failed to get analytics dashboard:', error);
        safeError(res, 500, 'Failed to retrieve analytics data');
    }
});

/**
 * @swagger
 * /api/v1/billing/analytics/revenue:
 *   get:
 *     summary: Get revenue metrics (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/revenue', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const timeframe = (req.query.timeframe as 'month' | 'quarter' | 'year') || 'month';
        const metrics = await paymentAnalyticsService.getRevenueMetrics(timeframe);
        res.json({ success: true, data: metrics });
    } catch (error) {
        logger.error('Failed to get revenue metrics:', error);
        safeError(res, 500, 'Failed to retrieve revenue metrics');
    }
});

/**
 * @swagger
 * /api/v1/billing/analytics/customers:
 *   get:
 *     summary: Get customer analytics (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/customers', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const metrics = await paymentAnalyticsService.getCustomerMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        logger.error('Failed to get customer metrics:', error);
        safeError(res, 500, 'Failed to retrieve customer metrics');
    }
});

/**
 * @swagger
 * /api/v1/billing/analytics/subscriptions:
 *   get:
 *     summary: Get subscription analytics (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/subscriptions', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const metrics = await paymentAnalyticsService.getSubscriptionMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        logger.error('Failed to get subscription metrics:', error);
        safeError(res, 500, 'Failed to retrieve subscription metrics');
    }
});

/**
 * @swagger
 * /api/v1/billing/analytics/payment-methods:
 *   get:
 *     summary: Get payment method analytics (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/payment-methods', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const analytics = await paymentAnalyticsService.getPaymentMethodAnalytics();
        res.json({ success: true, data: analytics });
    } catch (error) {
        logger.error('Failed to get payment method analytics:', error);
        safeError(res, 500, 'Failed to retrieve payment method analytics');
    }
});

/**
 * @swagger
 * /api/v1/billing/analytics/churn:
 *   get:
 *     summary: Get churn prediction analytics (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/churn', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const prediction = await paymentAnalyticsService.getChurnPrediction();
        res.json({ success: true, data: prediction });
    } catch (error) {
        logger.error('Failed to get churn prediction:', error);
        safeError(res, 500, 'Failed to retrieve churn analytics');
    }
});

/**
 * @swagger
 * /api/v1/billing/analytics/cohorts:
 *   get:
 *     summary: Get cohort analysis (Admin only)
 *     tags: [Billing]
 */
router.get('/analytics/cohorts', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const cohorts = await paymentAnalyticsService.getCohortAnalysis();
        res.json({ success: true, data: cohorts });
    } catch (error) {
        logger.error('Failed to get cohort analysis:', error);
        safeError(res, 500, 'Failed to retrieve cohort analysis');
    }
});

/**
 * @swagger
 * /api/v1/billing/admin/config:
 *   patch:
 *     summary: Update billing configuration (Admin only)
 *     tags: [Billing]
 */
router.patch('/admin/config', authorize(['admin']), async (req: AuthRequest, res) => {
    try {
        const { stripeSecretKey, paypalClientId } = req.body;
        if (stripeSecretKey) await systemConfigService.set('STRIPE_SECRET_KEY', stripeSecretKey, true);
        if (paypalClientId) await systemConfigService.set('PAYPAL_CLIENT_ID', paypalClientId, false);

        await paymentService.reloadConfiguration();
        res.json({ success: true, message: 'Billing configuration updated successfully' });
    } catch (error) {
        logger.error('Failed to update billing configuration:', error);
        safeError(res, 500, 'Internal server error');
    }
});

export default router;
