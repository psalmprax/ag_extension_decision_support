import { Router, Request, Response } from 'express';
import type { CountRow, SupportTicketRow, AuthenticatedRequestUser } from '@/types/rowTypes';
import { mapSupportTicketRows, mapSupportTicketRow, mapCountRow } from '@/types/dtos';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

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
