/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { smsService } from '../services/smsService';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../services/usageService';

const router = Router();

// Apply authentication to all SMS routes
router.use(authorize('admin', 'regional_manager', 'extension_officer'));

// SMS Schema
const sendSMSSchema = z.object({
    to: z.string().min(1, 'Phone number is required'),
    message: z.string().min(1, 'Message is required'),
});

// Bulk SMS Schema
const bulkSMSSchema = z.object({
    recipients: z.array(z.string()).min(1, 'At least one recipient required'),
    message: z.string().min(1, 'Message is required'),
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
});

// Send single SMS
router.post('/send', checkUsageLimit('sms'), validate({ body: sendSMSSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { to, message } = req.body;

        const success = await smsService.sendSMS({ to, message });

        if (success) {
            await usageService.incrementUsage(req.user!.userId, 'sms');
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
        const { recipients, message } = req.body;

        const result = await smsService.sendBulkSMS({ recipients, message });

        if (result.sent > 0) {
            // For bulk, we increment by the number of sent messages? 
            // Or just 1 bulk operation? Usually SMS is billed per recipient.
            for (let i = 0; i < result.sent; i++) {
                await usageService.incrementUsage(req.user!.userId, 'sms');
            }
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
router.post('/schedule', validate({ body: scheduleSMSSchema }), async (req: Request, res: Response) => {
    try {
        const { to, message, scheduledTime } = req.body;

        const success = await smsService.scheduleSMS(
            to,
            message,
            new Date(scheduledTime)
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
