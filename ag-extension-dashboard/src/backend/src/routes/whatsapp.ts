import axios from 'axios';
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
import { symptomTriageService } from '@/services/symptomTriageService';
import { transcribeVoiceNote, synthesizeVoiceAdvisory } from '@/services/voiceAudioService';
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
interface InboundMessagePayload {
    from?: string;
    body?: string;
    messageId?: string;
    timestamp?: string;
    From?: string; // Twilio format fallback
    Body?: string; // Twilio format fallback
    ProfileName?: string;
    MediaUrl0?: string;
    MediaContentType0?: string;
    audioUrl?: string;
    audioBase64?: string;
    mimeType?: string;
    mediaContentType?: string;
}

const SSRF_BLOCKED_HOSTS = new Set([
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '[::]',
]);

const SSRF_BLOCKED_PREFIXES = [
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
];

function isSafeWebhookMediaUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        const lowerHost = parsed.hostname.toLowerCase();
        if (SSRF_BLOCKED_HOSTS.has(lowerHost)) return false;
        for (const prefix of SSRF_BLOCKED_PREFIXES) {
            if (lowerHost.startsWith(prefix)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

async function resolveAudioPayload(payload: InboundMessagePayload): Promise<{ buffer?: Buffer; url?: string; mimeType: string } | null> {
    const url = payload.MediaUrl0 || payload.audioUrl;
    const mimeType = payload.MediaContentType0 || payload.mimeType || payload.mediaContentType || 'audio/ogg';

    if (payload.audioBase64) {
        return { buffer: Buffer.from(payload.audioBase64, 'base64'), mimeType };
    }

    if (url) {
        if (!isSafeWebhookMediaUrl(url)) {
            logger.warn(`Rejected potential SSRF or unsupported audio URL in WhatsApp inbound: ${url}`);
            return null;
        }
        try {
            const resp = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 8000,
                maxContentLength: 12 * 1024 * 1024,
            });
            return { buffer: Buffer.from(resp.data), url, mimeType };
        } catch (err) {
            logger.warn('Could not download audio from remote URL for transcription:', err);
            return { url, mimeType };
        }
    }

    return null;
}

async function transcribeInboundAudio(audioInfo: { buffer?: Buffer; url?: string; mimeType: string }): Promise<{ transcription: string; detectedLanguage: 'sw' | 'en' | string } | null> {
    try {
        const tr = await transcribeVoiceNote({
            audioBuffer: audioInfo.buffer,
            audioUrl: audioInfo.url,
            mimeType: audioInfo.mimeType,
            languageHint: 'sw',
        });
        return {
            transcription: tr.transcription,
            detectedLanguage: tr.detectedLanguage || 'sw',
        };
    } catch (err) {
        logger.error('Failed to transcribe inbound voice note:', err);
        return null;
    }
}

async function synthesizeOutboundAudio(text: string, language: string): Promise<string | undefined> {
    try {
        const langCode = (language === 'sw' || language === 'en') ? language : 'sw';
        const syn = await synthesizeVoiceAdvisory({ text, language: langCode });
        if (syn?.audioBase64) {
            return `data:${syn.format};base64,${syn.audioBase64}`;
        }
    } catch (err) {
        logger.warn('Failed to synthesize outbound voice advisory:', err);
    }
    return undefined;
}

async function handleInboundAdvisoryOrOnboarding(
    from: string,
    body: string,
    senderName?: string
): Promise<{ responseText?: string; farmerId?: string; handled: boolean }> {
    const onboardingResult = await onboardingEngine.processIncomingMessage({
        channel: 'whatsapp',
        identifier: from,
        message: body,
        senderName,
    });

    if (onboardingResult.isHandled && onboardingResult.responseMessage) {
        return {
            responseText: onboardingResult.responseMessage,
            farmerId: onboardingResult.farmerId,
            handled: true,
        };
    }

    if (!onboardingResult.isHandled && onboardingResult.isRegistered) {
        const triageReply = await symptomTriageService.handleDiagnoseMessage(
            body,
            onboardingResult.farmerId ?? null,
            from
        );
        return {
            responseText: triageReply,
            farmerId: onboardingResult.farmerId,
            handled: Boolean(triageReply),
        };
    }

    return { handled: false };
}

async function extractInboundMessageContent(payload: InboundMessagePayload): Promise<{
    from: string;
    body: string;
    senderName?: string;
    isVoice: boolean;
    detectedLang: string;
}> {
    const from = (payload.from || payload.From?.replace('whatsapp:', '') || '').trim();
    let body = payload.body || payload.Body || '';
    const senderName = payload.ProfileName;

    let isVoice = false;
    let detectedLang = 'sw';

    const audioInfo = await resolveAudioPayload(payload);
    if (audioInfo) {
        const tr = await transcribeInboundAudio(audioInfo);
        if (tr) {
            isVoice = true;
            detectedLang = tr.detectedLanguage;
            body = body.trim().length === 0
                ? tr.transcription
                : `${body}\n[Audio transcript]: ${tr.transcription}`;
        }
    }

    return { from, body, senderName, isVoice, detectedLang };
}

async function dispatchOutboundResponse(
    from: string,
    dispatch: { responseText?: string; farmerId?: string; handled: boolean },
    isVoice: boolean,
    detectedLang: string
): Promise<void> {
    if (!dispatch.responseText) return;

    let mediaUrl: string | undefined;
    if (isVoice) {
        mediaUrl = await synthesizeOutboundAudio(dispatch.responseText, detectedLang);
    }

    await whatsappService.sendMessage({
        to: from,
        message: dispatch.responseText,
        farmerId: dispatch.farmerId,
        mediaUrl,
        isVoiceNote: isVoice,
    });
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
        const { from, body, senderName, isVoice, detectedLang } = await extractInboundMessageContent(payload);

        if (!from || !body) {
            return res.status(400).json({ success: false, error: 'from and body are required' });
        }

        const { rows } = await query<WhatsAppMessageRow>(
            `INSERT INTO whatsapp_messages (recipient_phone, message, direction, status, provider)
             VALUES ($1, $2, 'inbound', 'received', 'meta_cloud')
             RETURNING *`,
            [from, body]
        );

        logger.info(`WhatsApp inbound ${payload.messageId ?? '-'}: ${rows.length} row(s) inserted (isVoice=${isVoice})`);

        const dispatch = await handleInboundAdvisoryOrOnboarding(from, body, senderName);
        await dispatchOutboundResponse(from, dispatch, isVoice, detectedLang);

        return res.status(202).json({
            success: true,
            handled: dispatch.handled,
            isVoice,
            transcription: isVoice ? body : undefined,
        });
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
