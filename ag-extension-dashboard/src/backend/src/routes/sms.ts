/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { smsService } from '../services/smsService';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../services/usageService';

import { AIRouter } from '../services/aiProvider/aiProvider';
import { query } from '../services/databaseService';

const router = Router();

// Apply authentication to all SMS routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

// SMS Schema
const sendSMSSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    message: z.string().min(1, 'Message is required'),
    farmerId: z.string().uuid().optional(),
});

// Bulk SMS Schema
const bulkSMSSchema = z.object({
    recipients: z.array(z.string()).min(1, 'At least one recipient required'),
    message: z.string().min(1, 'Message is required'),
    farmerId: z.string().uuid().optional(),
});

// Translate Schema
const translateSchema = z.object({
    text: z.string().min(1, 'Text is required'),
    targetLanguage: z.string().min(2, 'Target language is required'),
});

// USSD Schema
const ussdSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    text: z.string(),
});

// Schedule SMS Schema
const scheduleSMSSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    message: z.string().min(1, 'Message is required'),
    scheduledTime: z.string().datetime(),
    farmerId: z.string().uuid().optional(),
});

// Send single SMS
router.post('/send', checkUsageLimit('sms'), validate({ body: sendSMSSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, message, farmerId } = req.body;
        const senderId = req.user!.userId;

        const success = await smsService.sendSMS({ 
            to, 
            message, 
            farmerId, 
            senderId 
        });

        if (success) {
            await usageService.incrementUsage(senderId, 'sms');
            res.json({ success: true, message: 'SMS sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send SMS' });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Send bulk SMS
router.post('/bulk', checkUsageLimit('sms'), validate({ body: bulkSMSSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { recipients, message, farmerId } = req.body;
        const senderId = req.user!.userId;

        const result = await smsService.sendBulkSMS({ 
            recipients, 
            message, 
            farmerId, 
            senderId 
        });

        if (result.sent > 0) {
            await usageService.incrementUsageBy(senderId, 'sms', result.sent);
        }

        res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            results: result.results,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get SMS history
router.get('/history', async (req: AuthRequest, res: Response) => {
    try {
        const { farmerId } = req.query;
        let sql = 'SELECT * FROM sms_history ';
        const params: any[] = [];

        if (farmerId) {
            sql += 'WHERE farmer_id = $1 ';
            params.push(farmerId);
        }

        sql += 'ORDER BY created_at DESC LIMIT 100';

        const result = await query(sql, params);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Translate SMS content
router.post('/translate', validate({ body: translateSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { text, targetLanguage } = req.body;

        const prompt = `Translate the following agricultural message to ${targetLanguage}. Keep it concise for SMS (max 160 chars if possible). Do not add any preamble or quotes.
        
        Message: ${text}`;

        const result = await AIRouter.routeRequest('generate', {
            prompt,
            options: { temperature: 0.3, maxTokens: 200 }
        });

        res.json({
            success: true,
            data: {
                translatedText: result.text.trim(),
                targetLanguage
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Start USSD session
router.post('/ussd/start', validate({ body: ussdSchema }), async (req: Request, res: Response) => {
    try {
        const { sessionId, phoneNumber, text } = req.body;

        const response = await smsService.startUSSDSession({ sessionId, phoneNumber, text });

        res.json({ response });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Handle USSD input
router.post('/ussd/handle', validate({ body: ussdSchema }), async (req: Request, res: Response) => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sessionId, phoneNumber: _phoneNumber, text } = req.body;

        const response = await smsService.handleUSSDInput(sessionId, text);

        res.json({ response });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Schedule SMS
router.post('/schedule', validate({ body: scheduleSMSSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, message, scheduledTime } = req.body;
        const userId = req.user!.userId;

        const success = await smsService.scheduleSMS(
            to,
            message,
            new Date(scheduledTime),
            userId
        );

        if (success) {
            res.json({ success: true, message: 'SMS scheduled successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to schedule SMS' });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
