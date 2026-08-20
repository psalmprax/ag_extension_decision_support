import { Router, Request, Response } from 'express';
import type { CountRow, SupportTicketRow, AuthenticatedRequestUser } from '@/types/rowTypes';
import { mapSupportTicketRows, mapSupportTicketRow, mapCountRow } from '@/types/dtos';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category: string;
}

const SUPPORT_FAQS: FAQItem[] = [
    {
        id: 'faq-1',
        question: 'How does offline-first sync work in remote rural areas without cellular coverage?',
        answer: 'GPExts is engineered with a resilient offline-first architecture. Extension officers can register farmers, record visit observations, capture diagnostic photos, and log notes completely offline. When returning to cellular range or Wi-Fi, all pending records synchronize seamlessly with conflict-free reconciliation and cryptographic timestamps.',
        category: 'sync',
    },
    {
        id: 'faq-2',
        question: 'How do I register a new farmer and map their plot boundaries?',
        answer: 'Navigate to the Farmers or Crops & Fields tab and click "Add Farmer" or "Draw Boundary". You can capture GPS coordinates directly on mobile/tablet, draw field polygons on the satellite map, or use the Bulk Import tool to ingest Excel/CSV registries with automatic geocoding.',
        category: 'farmers',
    },
    {
        id: 'faq-3',
        question: 'How does AI Crop Disease Diagnosis work?',
        answer: 'Under the Disease Diagnosis tab, capture or upload a clear photo of affected leaves, stems, or fruits. The on-device vision model analyzes visual pathology patterns, generates an interpretable saliency heat map, identifies the pathogen with confidence scores, and provides immediate agronomic treatment protocols.',
        category: 'ai',
    },
    {
        id: 'faq-4',
        question: 'How do I broadcast SMS, WhatsApp, and Telegram agronomic advisories?',
        answer: 'Use the Broadcast & Channels hub or Autonomous Campaign Agent to draft personalized alerts. You can filter by crop, district, or health vital score, preview the message template, and dispatch multi-channel broadcasts across Africa\'s Talking SMS, Meta WhatsApp Cloud API, and Telegram Bot.',
        category: 'channels',
    },
    {
        id: 'faq-5',
        question: 'What meteorological and soil data sources are integrated?',
        answer: 'Every plot is automatically connected to NASA POWER daily solar & precipitation data for localized microclimate modeling, alongside ISRIC SoilGrids for soil pH, organic carbon, cation exchange capacity, and texture telemetry.',
        category: 'telemetry',
    },
    {
        id: 'faq-6',
        question: 'How is organizational and farmer data protected?',
        answer: 'GPExts enforces tenant database isolation, AES-256 encryption at rest, TLS 1.3 in transit, and role-based access control (RBAC). In addition, full Data Rights tools enable audited compliance exports and cryptographic erasure upon request.',
        category: 'security',
    },
    {
        id: 'faq-7',
        question: 'How does the Priority Queue schedule field inspection visits?',
        answer: 'The system continuously evaluates farmer vital health scores (0–100) based on days since last visit, disease severity alerts, and climate stress. Farmers scoring below 65 are automatically prioritized for field visits.',
        category: 'visits',
    },
];

/**
 * GET /api/support/faq — Retrieve frequently asked questions for the Help Center.
 */
router.get('/faq', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), (req: Request, res: Response) => {
    const category = typeof req.query.category === 'string' ? req.query.category : null;
    const data = category
        ? SUPPORT_FAQS.filter(f => f.category.toLowerCase() === category.toLowerCase())
        : SUPPORT_FAQS;
    return res.json({ success: true, data });
});

/**
 * GET /api/support/tickets — list support tickets visible to the caller.
 */
router.get('/tickets', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
    try {
        const user = req.user;
        const params: unknown[] = [];
        const where: string[] = [];

        let sql = 'SELECT * FROM support_tickets';
        if (user?.role && user.role !== 'admin' && user.role !== 'regional_manager') {
            where.push('user_id = $1');
            params.push(user.userId);
        }
        if (where.length > 0) {
            sql += ' WHERE ' + where.join(' AND ');
        }
        sql += ' ORDER BY created_at DESC LIMIT 100';

        const { rows } = await query<SupportTicketRow>(sql, params);

        return res.json({ success: true, data: mapSupportTicketRows(rows) });
    } catch (error) {
        logger.error('Failed to list support tickets:', error);
        return safeError(res, 500, 'Failed to list support tickets');
    }
});

/**
 * POST /api/support/tickets — create a support ticket.
 */
router.post('/tickets', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const body = req.body as { subject?: string; description?: string; category?: string; priority?: string };
        if (!body.subject || !body.description) {
            return res.status(400).json({ success: false, error: 'subject and description are required' });
        }

        const { rows } = await query<SupportTicketRow>(
            `INSERT INTO support_tickets (user_id, subject, description, status, priority, category)
             VALUES ($1, $2, $3, 'open', $4, $5)
             RETURNING *`,
            [userId, body.subject, body.description, body.priority ?? 'normal', body.category ?? 'general']
        );

        const created = rows[0];
        return res.status(201).json({ success: true, data: created ? mapSupportTicketRow(created) : null });
    } catch (error) {
        logger.error('Failed to create support ticket:', error);
        return safeError(res, 500, 'Failed to create support ticket');
    }
});

/**
 * PATCH /api/support/tickets/:id — update status / assignment (admin only).
 */
router.patch('/tickets/:id', authorize(['admin', 'regional_manager']), async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Ticket id is required' });
        }
        const updates = req.body as { status?: string; assigned_to?: string; priority?: string };

        const fields: string[] = [];
        const params: unknown[] = [];
        let i = 1;
        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) continue;
            fields.push(`${key} = $${i++}`);
            params.push(value);
        }
        if (updates.status === 'resolved') {
            fields.push(`resolved_at = NOW()`);
        }
        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No updates supplied' });
        }
        params.push(id);

        const { rows } = await query<SupportTicketRow>(
            `UPDATE support_tickets SET ${fields.join(', ')}, updated_at = NOW()
              WHERE id = $${i}
             RETURNING *`,
            params
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }
        const updated = rows[0];
        return res.json({ success: true, data: updated ? mapSupportTicketRow(updated) : null });
    } catch (error) {
        logger.error('Failed to update support ticket:', error);
        return safeError(res, 500, 'Failed to update support ticket');
    }
});

/**
 * GET /api/support/tickets/stats — open ticket counts (admin only).
 */
router.get('/tickets/stats', authorize(['admin', 'regional_manager']), async (_req: Request, res: Response) => {
    try {
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        const { rows: openRows } = await query<CountRow>(
            "SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'in_progress')"
        );
        const { rows: totalRows } = await query<CountRow>(
            'SELECT COUNT(*) as count FROM support_tickets'
        );

        const [open] = openRows.map(mapCountRow);
        const [total] = totalRows.map(mapCountRow);

        return res.json({
            success: true,
            data: {
                open: open?.count ?? 0,
                total: total?.count ?? 0,
            },
        });
    } catch (error) {
        logger.error('Failed to fetch support stats:', error);
        return safeError(res, 500, 'Failed to fetch support stats');
    }
});

export default router;
