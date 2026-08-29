import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import type { AuthenticatedRequestUser, CountRow, WhatsAppMessageRow } from '@/types/rowTypes';
import { mapWhatsAppMessageRows, mapWhatsAppMessageRow, mapCountRows } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { verifyInboundWebhookSignature } from '@/middleware/webhookSignature';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { whatsappService } from '@/services/whatsappService';
import { onboardingEngine } from '@/services/onboardingEngine';
import { checkMessageAccess, MessageAccessError, resolvePrincipalRegion } from '@/services/messageAccessService';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/**
 * GET /api/whatsapp/inbound — Meta Cloud API Webhook Verification Challenge
 */
router.get('/inbound', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) {
        if (process.env.NODE_ENV === 'production') {
            logger.crit('META_WEBHOOK_VERIFY_TOKEN not set in production — WhatsApp webhook is insecure');
            return res.status(500).json({ error: 'Webhook verification not configured' });
        }
        logger.warn('META_WEBHOOK_VERIFY_TOKEN not set — using dev fallback (NOT for production)');
    }
    if (!verifyToken) {
        return res.status(503).json({ error: 'Webhook verification is not configured' });
    }
    if (mode === 'subscribe' && token === verifyToken) {
        logger.info('Meta WhatsApp webhook verified successfully');
        return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification token mismatch' });
});

/**
 * POST /api/whatsapp/inbound — webhook endpoint for inbound messages from Meta Cloud API or Twilio WhatsApp.
 * Requests must carry a valid provider signature (see middleware/webhookSignature).
 */
router.post('/inbound', verifyInboundWebhookSignature, async (req: Request, res: Response) => {
    try {
        const payload = req.body as {
            from?: string;
            body?: string;
            messageId?: string;
            timestamp?: string;
            From?: string; // Twilio format fallback
            Body?: string; // Twilio format fallback
            ProfileName?: string;
        };

        const from = payload.from || payload.From?.replace('whatsapp:', '');
        const body = payload.body || payload.Body;
        const senderName = payload.ProfileName;

        if (!from || !body) {
            return res.status(400).json({ success: false, error: 'from and body are required' });
        }

        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (recipient_phone, message, direction, status, provider)
             VALUES ($1, $2, 'inbound', 'received', 'meta_cloud')
             RETURNING *`,
            [from, body]
        );

        logger.info(`WhatsApp inbound ${payload.messageId ?? '-'}: ${rows.length} row(s) inserted`);

        // Run through auto-onboarding engine
        const onboardingResult = await onboardingEngine.processIncomingMessage({
            channel: 'whatsapp',
            identifier: from,
            message: body,
            senderName,
        });

        if (onboardingResult.isHandled && onboardingResult.responseMessage) {
            await whatsappService.sendMessage({
                to: from,
                message: onboardingResult.responseMessage,
                farmerId: onboardingResult.farmerId,
            });
        }

        return res.status(202).json({ success: true, handled: onboardingResult.isHandled });
    } catch (error) {
        logger.error('Failed to persist WhatsApp inbound message:', error);
        return safeError(res, 500, 'Failed to persist WhatsApp inbound message');
    }
});

// Authenticated Routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

async function buildMessageScope(user: AuthenticatedRequestUser | undefined): Promise<{ sql: string; params: unknown[] }> {
    if (user?.role === 'extension_officer') {
        return {
            sql: `SELECT wm.* FROM whatsapp_messages wm
                 WHERE (wm.farmer_id IS NOT NULL AND wm.farmer_id IN
                     (SELECT id FROM farmers WHERE assigned_officer_id = $1))
                    OR wm.recipient_phone IN
                     (SELECT COALESCE(phone, '') FROM farmers WHERE assigned_officer_id = $1)`,
            params: [user.userId],
        };
    }
    if (user?.role === 'regional_manager') {
        const region = await resolvePrincipalRegion(user.userId);
        if (!region) return { sql: 'SELECT wm.* FROM whatsapp_messages wm WHERE 1=0', params: [] };
        return {
            sql: `SELECT wm.* FROM whatsapp_messages wm
                 WHERE (wm.farmer_id IS NOT NULL AND wm.farmer_id IN
                     (SELECT id FROM farmers WHERE region = $1))
                    OR wm.recipient_phone IN
                     (SELECT COALESCE(phone, '') FROM farmers WHERE region = $1)`,
            params: [region],
        };
    }
    return { sql: 'SELECT * FROM whatsapp_messages', params: [] };
}

/**
 * GET /api/whatsapp/messages — paginated message history, scoped by role.
 * Officers see messages involving their assigned farmers; regional managers see
 * messages involving farmers in their region; admins see all.
 */
router.get('/messages', async (req: Request, res: Response) => {
    try {
        const user = req.user as AuthenticatedRequestUser | undefined;
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
        const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

        const scope = await buildMessageScope(user);
        const params = [...scope.params];
        const paramIdx = params.length + 1;
        const scopeSql = scope.sql + ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(limit, offset);

        const { rows } = await query<WhatsAppMessageRow>(scopeSql, params);

        return res.json({ success: true, data: mapWhatsAppMessageRows(rows), limit, offset });
    } catch (error) {
        logger.error('Failed to list WhatsApp messages:', error);
        return safeError(res, 500, 'Failed to list WhatsApp messages');
    }
});

/**
 * POST /api/whatsapp/send — send a WhatsApp message (logged record + dispatch hook).
 */
router.post('/send', checkUsageLimit('whatsapp'), async (req: AuthedRequest, res: Response) => {
    try {
        const body = req.body as { to?: string; message?: string; farmerId?: string };
        if (!body.to || !body.message) {
            return res.status(400).json({ success: false, error: 'to and message are required' });
        }

        // Write-scope enforcement: an officer may only WhatsApp their assigned farmers.
        const resolvedFarmerId = await checkMessageAccess(
            req.user!,
            { farmerId: body.farmerId, phone: body.to }
        );

        const providerConfigured = whatsappService.isConfigured();
        const deliveryStatus = providerConfigured ? 'queued' : 'not_configured';
        const provider = providerConfigured ? 'twilio' : 'none';
        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (recipient_phone, message, direction, status, farmer_id, sender_id, provider)
             VALUES ($1, $2, 'outbound', $3, $4, $5, $6)
             RETURNING *`,
            [body.to, body.message, deliveryStatus, resolvedFarmerId ?? null, req.user?.userId ?? null, provider]
        );

        const created = rows[0];
        return res.status(providerConfigured ? 202 : 503).json({
            success: providerConfigured,
            status: deliveryStatus,
            data: created ? mapWhatsAppMessageRow(created) : null,
            error: providerConfigured ? undefined : 'WhatsApp provider is not configured',
        });
    } catch (error) {
        if (error instanceof MessageAccessError) {
            return safeError(res, error.statusCode, error.message);
        }
        logger.error('Failed to send WhatsApp message:', error);
        return safeError(res, 500, 'Failed to send WhatsApp message');
    }
});

/**
 * GET /api/whatsapp/stats — message counts for the dashboard, scoped by role.
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const user = req.user as AuthenticatedRequestUser | undefined;
        // Scoped reads: officers → assigned farmers, managers → their region.
        // `AND` (not a second `WHERE`) chains onto the direction filter, and both
        // subqueries share $1.
        let scopeClause = '';
        let scopedParams: unknown[] = [];
        if (user?.role === 'extension_officer') {
            scopeClause = `AND ((farmer_id IS NOT NULL AND farmer_id IN
                   (SELECT id FROM farmers WHERE assigned_officer_id = $1))
               OR recipient_phone IN
                   (SELECT COALESCE(phone, '') FROM farmers WHERE assigned_officer_id = $1))`;
            scopedParams = [user.userId];
        } else if (user?.role === 'regional_manager') {
            const region = await resolvePrincipalRegion(user.userId);
            if (region) {
                scopeClause = `AND ((farmer_id IS NOT NULL AND farmer_id IN
                       (SELECT id FROM farmers WHERE region = $1))
                   OR recipient_phone IN
                       (SELECT COALESCE(phone, '') FROM farmers WHERE region = $1))`;
                scopedParams = [region];
            }
        }
        const { rows: inbound } = await query<CountRow>(
            `SELECT COUNT(*) AS count FROM whatsapp_messages WHERE direction = 'inbound' ${scopeClause}`,
            scopedParams
        );
        const { rows: outbound } = await query<CountRow>(
            `SELECT COUNT(*) AS count FROM whatsapp_messages WHERE direction = 'outbound' ${scopeClause}`,
            scopedParams
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
