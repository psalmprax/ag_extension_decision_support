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
import { ASK_HELP, messagingKnowledgeReply, parseAskCommand } from '@/services/knowledge/messagingHints';
import { readInboundContent, type InboundContent, type WhatsAppMediaPayload } from '@/services/chat/whatsappInboundMedia';
import type { InboundMedia } from '@/services/chat/inboundMedia';
import { synthesizeVoiceReply } from '@/services/chat/voiceReply';
import { checkMessageAccess, MessageAccessError, resolvePrincipalRegion } from '@/services/messageAccessService';
import { linkedDemoSql } from '@/services/demoScope';
import { claimInboundEvent, takeRegisteredFarmerMessage } from '@/services/chat/channelInbound';
import { findStaffByPhone } from '@/services/sms/officerSmsAccess';
import { handleOfficerWhatsApp } from '@/services/chat/officerWhatsApp';
import { WHATSAPP_ASK_AI_PAYLOAD } from '@/services/chat/channelThread';

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
interface InboundMessagePayload extends WhatsAppMediaPayload {
    from?: string;
    To?: string;
    body?: string;
    messageId?: string;
    MessageSid?: string;
    timestamp?: string;
    From?: string; // Twilio format fallback
    Body?: string; // Twilio format fallback
    /** Twilio: the payload of a tapped quick-reply button. */
    ButtonPayload?: string;
    ProfileName?: string;
}

async function handleInboundAdvisoryOrOnboarding(
    from: string,
    body: string,
    senderName?: string,
    eventId?: string,
    voice?: { isVoice: boolean; language: string },
    media: InboundMedia[] = [],
): Promise<{ responseText?: string; farmerId?: string; handled: boolean }> {
    // A registered farmer's message goes into their thread; replies are sent from there
    // (spoken too, when the farmer sent a voice note).
    if (await takeRegisteredFarmerMessage({
        channel: 'whatsapp', identifier: from, text: body, eventId,
        isVoice: voice?.isVoice, language: voice?.isVoice ? voice.language : undefined, media,
    })) {
        return { handled: true };
    }
    const question = parseAskCommand(body);
    if (question !== null) {
        return { responseText: await messagingKnowledgeReply(question), handled: true };
    }
    const onboardingResult = await onboardingEngine.processIncomingMessage({
        channel: 'whatsapp',
        identifier: from,
        message: body,
        senderName,
        eventId,
    });

    if (onboardingResult.isHandled && onboardingResult.responseMessage) {
        return {
            responseText: onboardingResult.responseMessage,
            farmerId: onboardingResult.farmerId,
            handled: true,
        };
    }

    if (!onboardingResult.isHandled && onboardingResult.isRegistered) {
        return {
            responseText: ASK_HELP,
            farmerId: onboardingResult.farmerId,
            handled: true,
        };
    }

    return { handled: false };
}

/** Our WhatsApp number, as the message was addressed (Twilio "To"), for the log. */
function businessNumber(payload: { To?: string }): string {
    return (payload.To?.replace('whatsapp:', '') || process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '') || process.env.WHATSAPP_PHONE_NUMBER_ID || 'whatsapp').slice(0, 20);
}

async function extractInboundMessageContent(payload: InboundMessagePayload): Promise<InboundContent & { from: string; senderName?: string }> {
    const from = (payload.from || payload.From?.replace('whatsapp:', '') || '').trim();
    // The Ask AI quick-reply button arrives as its payload; treat it as the ASK AI code.
    const text = payload.ButtonPayload === WHATSAPP_ASK_AI_PAYLOAD ? 'ASK AI' : payload.body || payload.Body || '';
    return { from, senderName: payload.ProfileName, ...(await readInboundContent(payload, text)) };
}

async function dispatchOutboundResponse(
    from: string,
    dispatch: { responseText?: string; farmerId?: string; handled: boolean },
    isVoice: boolean,
    detectedLang: string
): Promise<boolean> {
    if (!dispatch.responseText) return true;

    let mediaUrl: string | undefined;
    if (isVoice) {
        mediaUrl = await synthesizeVoiceReply(dispatch.responseText, detectedLang);
    }

    const sent = await whatsappService.sendMessage({
        to: from,
        message: dispatch.responseText,
        farmerId: dispatch.farmerId,
        mediaUrl,
        isVoiceNote: isVoice,
    });
    return sent.success;
}

/**
 * POST /api/whatsapp/inbound — webhook endpoint for inbound messages from Meta Cloud API or Twilio WhatsApp.
 * Supports text messages and inbound voice notes with automatic speech transcription,
 * disease symptom triage, and synthesized vernacular voice advisory replies.
 * Requests must carry a valid provider signature (see middleware/webhookSignature).
 */
router.post('/inbound', verifyInboundWebhookSignature, async (req: Request, res: Response) => {
    try {
        const payload = req.body as InboundMessagePayload;
        const content = await extractInboundMessageContent(payload);
        const { from, body, senderName, isVoice, detectedLang, media } = content;

        if (!from || !body) {
            return res.status(400).json({ success: false, error: 'from and body are required' });
        }

        // An officer's or manager's number: run their command instead of farmer sign-up.
        const staff = await findStaffByPhone(from);
        if (staff) {
            const staffEventId = payload.messageId || payload.MessageSid;
            if (!staffEventId || await claimInboundEvent('whatsapp', from, staffEventId)) {
                setImmediate(() => {
                    handleOfficerWhatsApp(staff, from, content).catch(error => logger.error('Officer WhatsApp message failed:', error));
                });
            }
            return res.status(202).json({ success: true, handled: true, isVoice });
        }

        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (from_phone, to_phone, body, direction, status, provider_id)
             VALUES ($1, $2, $3, 'inbound', 'received', $4)
             RETURNING *`,
            [from, businessNumber(payload), body, payload.messageId || payload.MessageSid || null]
        );

        logger.info(`WhatsApp inbound ${payload.messageId ?? '-'}: ${rows.length} row(s) inserted (isVoice=${isVoice})`);

        const eventId = payload.messageId || payload.MessageSid;
        const dispatch = await handleInboundAdvisoryOrOnboarding(from, body, senderName, eventId, { isVoice, language: detectedLang }, media);
        if (!await dispatchOutboundResponse(from, dispatch, isVoice, detectedLang)) {
            return safeError(res, 503, 'Failed to send WhatsApp reply');
        }

        return res.status(202).json({
            success: true,
            handled: dispatch.handled,
            isVoice,
            transcription: isVoice ? body : undefined,
        });
    } catch (error) {
        logger.error('Failed to process WhatsApp inbound message:', error);
        return safeError(res, 500, 'Failed to process WhatsApp inbound message');
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
                    OR wm.to_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE assigned_officer_id = $1)
                    OR wm.from_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE assigned_officer_id = $1)`,
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
                    OR wm.to_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE region = $1)
                    OR wm.from_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE region = $1)`,
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
        const scopeSql = `SELECT * FROM (${scope.sql}) scoped WHERE ${linkedDemoSql('scoped', user)}`
            + ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
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
        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (to_phone, body, direction, status, farmer_id, tenant_id)
             VALUES ($1, $2, 'outbound', $3, $4, (SELECT tenant_id FROM users WHERE id = $5))
             RETURNING *`,
            [body.to, body.message, deliveryStatus, resolvedFarmerId ?? null, req.user?.userId ?? null]
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
               OR to_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE assigned_officer_id = $1)
               OR from_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE assigned_officer_id = $1))`;
            scopedParams = [user.userId];
        } else if (user?.role === 'regional_manager') {
            const region = await resolvePrincipalRegion(user.userId);
            if (region) {
                scopeClause = `AND ((farmer_id IS NOT NULL AND farmer_id IN
                       (SELECT id FROM farmers WHERE region = $1))
                   OR to_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE region = $1)
                   OR from_phone IN (SELECT COALESCE(phone, '') FROM farmers WHERE region = $1))`;
                scopedParams = [region];
            }
        }
        scopeClause = `${scopeClause} AND ${linkedDemoSql('whatsapp_messages', user)}`;
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
