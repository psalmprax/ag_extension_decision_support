/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsappService';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all WhatsApp routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

// Schema for sending a WhatsApp message
const sendMessageSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    message: z.string().min(1, 'Message is required'),
    farmerId: z.string().uuid().optional(),
});

// Schema for sending bulk WhatsApp messages
const bulkMessageSchema = z.object({
    recipients: z.array(z.string()).min(1, 'At least one recipient required'),
    message: z.string().min(1, 'Message is required'),
    farmerId: z.string().uuid().optional(),
});

// Schema for sending alerts
const sendAlertSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    alertTitle: z.string().min(1, 'Alert title is required'),
    alertDescription: z.string().min(1, 'Alert description is required'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    farmerId: z.string().uuid().optional(),
});

// Schema for sending weather updates
const weatherUpdateSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    location: z.string().min(1, 'Location is required'),
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
    farmerId: z.string().uuid().optional(),
});

// Schema for sending market prices
const marketPriceSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    prices: z.array(z.object({
        crop: z.string(),
        price: z.string(),
        trend: z.string(),
    })).min(1, 'At least one price required'),
    farmerId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/whatsapp/send
 * Send a WhatsApp message
 */
router.post('/send', validate({ body: sendMessageSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, message, farmerId } = req.body;
        const senderId = req.user!.userId;

        const success = await whatsappService.sendMessage({ to, message, farmerId, senderId });

        if (success) {
            res.json({ success: true, message: 'WhatsApp message sent successfully' });
        } else {
            safeError(res, 500, 'Failed to send WhatsApp message');
        }
    } catch (error: any) {
        logger.error('WhatsApp send error:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * POST /api/v1/whatsapp/bulk
 * Send bulk WhatsApp messages
 */
router.post('/bulk', validate({ body: bulkMessageSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { recipients, message, farmerId } = req.body;
        const senderId = req.user!.userId;

        const result = await whatsappService.sendBulkMessages({ recipients, message, farmerId, senderId });

        res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            results: result.results,
        });
    } catch (error: any) {
        logger.error('WhatsApp bulk send error:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * POST /api/v1/whatsapp/alert
 * Send an agricultural alert via WhatsApp
 */
router.post('/alert', validate({ body: sendAlertSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, alertTitle, alertDescription, severity, farmerId } = req.body;

        const success = await whatsappService.sendAlert(to, alertTitle, alertDescription, severity as 'low' | 'medium' | 'high' | 'critical', farmerId);

        if (success) {
            res.json({ success: true, message: 'Alert sent via WhatsApp' });
        } else {
            safeError(res, 500, 'Failed to send alert');
        }
    } catch (error: any) {
        logger.error('WhatsApp alert error:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * POST /api/v1/whatsapp/weather
 * Send a weather update via WhatsApp
 */
router.post('/weather', validate({ body: weatherUpdateSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, location, temperature, condition, humidity, farmerId } = req.body;

        const success = await whatsappService.sendWeatherUpdate(to, location, temperature, condition, humidity, farmerId);

        if (success) {
            res.json({ success: true, message: 'Weather update sent via WhatsApp' });
        } else {
            safeError(res, 500, 'Failed to send weather update');
        }
    } catch (error: any) {
        logger.error('WhatsApp weather error:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * POST /api/v1/whatsapp/market-prices
 * Send market price update via WhatsApp
 */
router.post('/market-prices', validate({ body: marketPriceSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, prices, farmerId } = req.body;

        const success = await whatsappService.sendMarketPriceUpdate(to, prices, farmerId);

        if (success) {
            res.json({ success: true, message: 'Market prices sent via WhatsApp' });
        } else {
            safeError(res, 500, 'Failed to send market prices');
        }
    } catch (error: any) {
        logger.error('WhatsApp market prices error:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * GET /api/v1/whatsapp/status
 * Check if WhatsApp service is configured
 */
router.get('/status', async (_req: Request, res: Response) => {
    const configured = whatsappService.isConfigured();
    res.json({
        success: true,
        data: {
            configured,
            provider: configured ? 'twilio' : 'none',
            message: configured ? 'WhatsApp service is configured' : 'WhatsApp service is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER.',
        },
    });
});

/**
 * POST /api/v1/whatsapp/webhook
 * Handle incoming WhatsApp messages (Twilio webhook)
 * This is a public endpoint for Twilio to call
 */
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const { From, Body } = req.body;

        logger.info(`WhatsApp webhook received: from=${From}, message=${Body?.substring(0, 100)}`);

        // Extract the phone number from the WhatsApp sender ID
        const fromNumber = From?.replace('whatsapp:', '') || 'unknown';

        // Store incoming message in SMS history
        const { query } = await import('../services/databaseService');
        await query(
            `INSERT INTO sms_history (recipient_phone, message, status, provider)
             VALUES ($1, $2, $3, $4)`,
            [fromNumber, `[WhatsApp Inbound] ${Body || ''}`, 'received', 'whatsapp']
        );

        // Respond to Twilio with an empty 200 to acknowledge receipt
        res.status(200).type('text/xml').send('<Response></Response>');
    } catch (error) {
        logger.error('WhatsApp webhook error:', error);
        res.status(200).type('text/xml').send('<Response></Response>');
    }
});

export default router;
