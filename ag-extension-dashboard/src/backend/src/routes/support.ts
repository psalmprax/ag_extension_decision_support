/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query, getPool } from '../services/databaseService';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

const FAQS = [
    {
        id: 'faq-register',
        question: 'How do I register a new farmer?',
        answer: 'Navigate to "Register Farmer" in the sidebar. Fill in the farmer\'s details including name, phone, location, and crops. You can also use the "Detect Location" button to auto-fill GPS coordinates.',
        category: 'farmers',
    },
    {
        id: 'faq-ai',
        question: 'How does the AI Advisor work?',
        answer: 'The AI Advisor uses RAG (Retrieval-Augmented Generation) to search the knowledge base and provide contextual agricultural advice. Simply type your question in the Knowledge Search tab.',
        category: 'ai',
    },
    {
        id: 'faq-visits',
        question: 'How do I schedule a farm visit?',
        answer: 'Go to the "Visits" tab and click "Schedule New Visit". Select a farmer, choose the visit type, set the date/time, and add optional notes.',
        category: 'visits',
    },
    {
        id: 'faq-sms',
        question: 'How do I send SMS to farmers?',
        answer: 'Navigate to the SMS section from the sidebar. You can send individual messages or bulk SMS. Select contacts from the farmer list, compose your message, and hit Send.',
        category: 'sms',
    },
    {
        id: 'faq-export',
        question: 'How do I export farmer data?',
        answer: 'In the Farmer Portfolio view, select the farmers you want to export using checkboxes, then click "Export CSV". You can also right-click on a farmer for context menu options.',
        category: 'portfolio',
    },
    {
        id: 'faq-offline',
        question: 'How does offline mode work?',
        answer: 'The browser extension supports offline operation. Actions are queued and synced when connectivity is restored. The dashboard shows your online/offline status in the header.',
        category: 'general',
    },
];

// Public FAQ endpoint (no auth required)
router.get('/faq', (_req: Request, res: Response) => {
    res.json({ success: true, data: FAQS });
});

// Apply authentication to remaining routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Submit a support ticket
router.post('/tickets', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const { subject, category, description } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ success: false, error: 'Subject and description are required' });
        }

        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const result = await query(`
            INSERT INTO support_tickets (user_id, subject, category, description, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'open', NOW(), NOW())
            RETURNING id, subject, category, status, created_at
        `, [userId, subject, category || 'general', description]);

        const ticket = result.rows[0];

        logger.info(`Support ticket created: ${ticket.id} by user ${userId}`);

        res.status(201).json({
            success: true,
            data: {
                id: ticket.id,
                subject: ticket.subject,
                category: ticket.category,
                status: ticket.status,
                createdAt: ticket.created_at,
            },
        });
    } catch (error) {
        logger.error('Create support ticket error:', error);
        safeError(res, 500, 'Failed to create support ticket');
    }
});

// Get user's support tickets
router.get('/tickets', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const result = await query(`
            SELECT id, subject, category, description, status, created_at, updated_at
            FROM support_tickets
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [userId]);

        res.json({
            success: true,
            data: result.rows.map((t: any) => ({
                id: t.id,
                subject: t.subject,
                category: t.category,
                description: t.description,
                status: t.status,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            })),
        });
    } catch (error) {
        logger.error('Get support tickets error:', error);
        safeError(res, 500, 'Failed to fetch support tickets');
    }
});

export default router;
