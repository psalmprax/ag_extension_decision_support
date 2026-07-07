import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import type { AuthenticatedRequestUser, CountRow, WhatsAppMessageRow } from '@/types/rowTypes';
import { mapWhatsAppMessageRows, mapWhatsAppMessageRow, mapCountRows } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * GET /api/whatsapp/messages — paginated message history.
 */
router.get('/messages', async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
        const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

        const { rows } = await query<WhatsAppMessageRow>(
            'SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        return res.json({ success: true, data: mapWhatsAppMessageRows(rows), limit, offset });
    } catch (error) {
        logger.error('Failed to list WhatsApp messages:', error);
        return safeError(res, 500, 'Failed to list WhatsApp messages');
    }
});

/**
 * POST /api/whatsapp/send — send a WhatsApp message (logged record + dispatch hook).
 */
router.post('/send', async (req: AuthedRequest, res: Response) => {
    try {
        const body = req.body as { to?: string; message?: string; farmerId?: string };
        if (!body.to || !body.message) {
            return res.status(400).json({ success: false, error: 'to and message are required' });
        }

        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (recipient_phone, message, direction, status, farmer_id, sender_id, provider)
             VALUES ($1, $2, 'outbound', 'queued', $3, $4, 'meta_cloud')
             RETURNING *`,
            [body.to, body.message, body.farmerId ?? null, req.user?.userId ?? null]
        );

        const created = rows[0];
        return res.status(201).json({ success: true, data: created ? mapWhatsAppMessageRow(created) : null });
    } catch (error) {
        logger.error('Failed to send WhatsApp message:', error);
        return safeError(res, 500, 'Failed to send WhatsApp message');
    }
});

/**
 * POST /api/whatsapp/inbound — webhook endpoint for inbound messages from Meta Cloud API.
 */
router.post('/inbound', async (req: Request, res: Response) => {
    try {
        const payload = req.body as {
            from?: string;
            body?: string;
            messageId?: string;
            timestamp?: string;
        };
        if (!payload.from || !payload.body) {
            return res.status(400).json({ success: false, error: 'from and body are required' });
        }

        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (recipient_phone, message, direction, status, provider)
             VALUES ($1, $2, 'inbound', 'received', 'meta_cloud')
             RETURNING *`,
            [payload.from, payload.body]
        );

        logger.info(`WhatsApp inbound ${payload.messageId ?? '-'}: ${rows.length} row(s) inserted`);
        return res.status(202).json({ success: true });
    } catch (error) {
        logger.error('Failed to persist WhatsApp inbound message:', error);
        return safeError(res, 500, 'Failed to persist WhatsApp inbound message');
    }
});

/**
 * GET /api/whatsapp/stats — message counts for the dashboard.
 */
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const { rows: inbound } = await query<CountRow>(
            "SELECT COUNT(*) AS count FROM whatsapp_messages WHERE direction = 'inbound'"
        );
        const { rows: outbound } = await query<CountRow>(
            "SELECT COUNT(*) AS count FROM whatsapp_messages WHERE direction = 'outbound'"
        );

        const [inboundCount] = mapCountRows(inbound);
        const [outboundCount] = mapCountRows(outbound);

        return res.json({
            success: true,
            data: {
                inbound: inboundCount?.count ?? 0,
                outbound: outboundCount?.count ?? 0,
            },
        });
    } catch (error) {
        logger.error('Failed to fetch WhatsApp stats:', error);
        return safeError(res, 500, 'Failed to fetch WhatsApp stats');
    }
});

export default router;
