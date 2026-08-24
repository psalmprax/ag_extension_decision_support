import { Router, Request, Response } from 'express';
import { query } from '../services/databaseService';
import { smsService } from '../services/smsService';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../services/usageService';

import type { SmsHistoryRow } from '@/types/rowTypes';
import { mapSmsHistoryRows } from '@/types/dtos';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { safeError } from '@/utils/safeResponse';
import { detectLanguage } from '@/utils/languageDetector';
import { onboardingEngine } from '@/services/onboardingEngine';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * POST /api/sms/inbound — Inbound SMS Webhook for Africa's Talking and Twilio
 */
router.post('/inbound', async (req: Request, res: Response) => {
    try {
        const from = req.body.from || req.body.From || req.body.phoneNumber;
        const text = req.body.text || req.body.Body || req.body.message;

        if (!from || !text) {
            return res.status(400).json({ success: false, error: 'from and text are required' });
        }

        logger.info(`Inbound SMS received from ${from}: ${text}`);

        // Run through auto-onboarding engine
        const onboardingResult = await onboardingEngine.processIncomingMessage({
            channel: 'sms',
            identifier: from,
            message: text,
        });

        if (onboardingResult.isHandled && onboardingResult.responseMessage) {
            await smsService.sendSMS({
                to: from,
                message: onboardingResult.responseMessage,
                farmerId: onboardingResult.farmerId,
            });
        }

        return res.status(200).json({ success: true, handled: onboardingResult.isHandled });
    } catch (error) {
        logger.error('Failed to process inbound SMS:', error);
        return safeError(res, 500, 'Failed to process inbound SMS');
    }
});

// Apply authentication to protected SMS management routes
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

// AI Diagnosis Schema
const aiDiagnosisSchema = z.object({
    symptoms: z.string().min(1, 'Symptoms description is required'),
    cropType: z.string().optional(),
    language: z.string().default('en'),
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
            safeError(res, 500, 'Failed to send SMS');
        }
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Internal server error');
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
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Internal server error');
    }
});

// Get SMS history — scoped by role
router.get('/history', async (req: AuthRequest, res: Response) => {
    try {
        const { farmerId } = req.query;
        const user = req.user;
        let sql = 'SELECT * FROM sms_history WHERE 1=1';
        const params: unknown[] = [];
        let paramIdx = 1;

        // Role-based scoping: farmers see their own, officers see their assigned farmers
        if (user?.role === 'farmer') {
            sql += ` AND farmer_id IN (SELECT id FROM farmers WHERE user_id = $${paramIdx++})`;
            params.push(user.userId);
        } else if (user?.role === 'extension_officer') {
            sql += ` AND farmer_id IN (SELECT id FROM farmers WHERE assigned_officer_id = $${paramIdx++})`;
            params.push(user.userId);
        }
        // admin and regional_manager see everything (no additional clause)

        if (farmerId) {
            sql += ` AND farmer_id = $${paramIdx++}`;
            params.push(farmerId);
        }

        sql += ' ORDER BY created_at DESC LIMIT 100';

        const result = await query<SmsHistoryRow>(sql, params);

        res.json({
            success: true,
            data: mapSmsHistoryRows(result.rows),
        });
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Internal server error');
    }
});

// Translate SMS content
router.post('/translate', validate({ body: translateSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { text, targetLanguage } = req.body;

        // Auto-detect source language
        const sourceLanguage = detectLanguage(text) || 'en';

        const prompt = `Translate this agricultural message from ${sourceLanguage} to ${targetLanguage}. Keep it concise for SMS (max 160 chars if possible). Do not add any preamble or quotes.

        Message: ${text}`;

        const provider = await AIProviderFactory.getProvider();
        const result = await provider.generateText(prompt, { temperature: 0.3, maxTokens: 200 });

        res.json({
            success: true,
            data: {
                translatedText: (result?.text ?? '').toString().trim(),
                targetLanguage,
                sourceLanguage
            }
        });
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Translation failed');
    }
});

// AI-Powered Disease Diagnosis via SMS
router.post('/ai-diagnosis', checkUsageLimit('ai_vision'), validate({ body: aiDiagnosisSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { symptoms, cropType, language } = req.body;

        if (!symptoms) {
            return res.status(400).json({ success: false, error: 'Symptoms description is required' });
        }

        const provider = await AIProviderFactory.getProvider();
        const prompt = `You are a professional agricultural plant pathologist. Analyze this SMS description and provide a concise disease diagnosis.

        Symptoms: ${symptoms}
        Crop Type: ${cropType || 'Not specified'}

        Provide response in this exact format:
        DISEASE: [Disease Name]
        CONFIDENCE: [0-100]
        SEVERITY: [mild/moderate/severe]
        TREATMENT: [Recommended treatment]
        PREVENTION: [Prevention measures]

        IMPORTANT: Return ONLY the above fields, no conversational text.`;

        const result = await provider.generateText([
            { role: 'system', content: 'You are an agricultural extension assistant.' },
            { role: 'user', content: prompt },
        ]);

        const analysis = result?.text ?? '';
        // Parse the structured response using helper function
        res.json({
            success: true,
            data: {
                rawResponse: analysis,
                disease: parseDiagnosisField(analysis, 'DISEASE'),
                confidence: parseInt(parseDiagnosisField(analysis, 'CONFIDENCE')) || 0,
                severity: parseDiagnosisField(analysis, 'SEVERITY') || 'unknown',
                treatment: parseDiagnosisField(analysis, 'TREATMENT') || 'No specific treatment recommended',
                language: language
            }
        });
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'AI diagnosis failed');
    }
});

// Helper function to parse diagnosis fields from AI response
// Previously defined above, now moved after the route handler
// Helper function to parse diagnosis fields from AI response
const parseDiagnosisField = (response: string, field: string): string => {
    const lines = response.split('\n');
    const fieldRegex = new RegExp(`^${field}:\\s*(.+)$`, 'i');
    for (const line of lines) {
        const match = line.match(fieldRegex);
        if (match) {
            return match[1].trim();
        }
    }
    return '';
};

// Start USSD session
router.post('/ussd/start', validate({ body: ussdSchema }), async (req: Request, res: Response) => {
    try {
        const { sessionId, phoneNumber, text } = req.body;

        const response = await smsService.startUSSDSession({ sessionId, phoneNumber, text });

        res.json({ response });
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Internal server error');
    }
});

// Handle USSD input
router.post('/ussd/handle', validate({ body: ussdSchema }), async (req: Request, res: Response) => {
    try {
        const { sessionId, text } = req.body;

        const response = await smsService.handleUSSDInput(sessionId, text);

        res.json({ response });
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Internal server error');
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
            safeError(res, 500, 'Failed to schedule SMS');
        }
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Internal server error');
    }
});

// SMS Feedback endpoint
router.post('/feedback', validate({
    body: z.object({
        rating: z.number().min(1).max(5),
        feedback: z.string().optional(),
        farmerId: z.string().uuid().optional(),
    })
}), async (req: AuthRequest, res: Response) => {
    try {
        const { rating, feedback, farmerId } = req.body;
        const userId = req.user!.userId;

        // Persist feedback to database
        await query(
            `INSERT INTO sms_feedback (user_id, farmer_id, rating, feedback, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, farmerId || null, rating, feedback || '']
        );

        // Also track usage
        await usageService.incrementUsage(userId, 'sms_feedback');

        res.json({
            success: true,
            message: `Thank you for your rating ${rating}/5`,
            thanked: true
        });
    } catch (error) {
        safeError(res, 500, error instanceof Error ? error.message : 'Failed to submit feedback');
    }
});

export default router;
