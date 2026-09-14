import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

const META_SIGNATURE_HEADER = 'x-hub-signature-256';
const TWILIO_SIGNATURE_HEADER = 'x-twilio-signature';

const safeHexEqual = (received: string, expected: string): boolean => {
    const a = Buffer.from(received, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
};

const verifyMetaSignature = (rawBody: Buffer, signatureHeader: string, appSecret: string): boolean => {
    if (!signatureHeader.startsWith('sha256=')) return false;
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    return safeHexEqual(signatureHeader, expected);
};

const verifyTwilioSignature = (req: Request, authToken: string): boolean => {
    // Twilio spec: HMAC-SHA1 over (full request URL + sorted "keyvalue" concatenation of POST params).
    // Strict mode: exact https URL with the presented host only. No http downgrade,
    // no port-stripped alternates — ambiguity here widens signature acceptance.
    const rawProto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const proto = rawProto.split(',')[0].trim();
    if (proto !== 'https') return false;
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
    // Strip the default :443 so reverse proxies that append it still match the
    // public URL Twilio signed. Non-default ports are NOT stripped: a signature
    // for a different authority must not validate. http is never accepted.
    const host = rawHost.split(',')[0].trim().replace(/:443$/, '');
    if (!host) return false;
    const params = Object.keys(req.body ?? {})
        .sort()
        .reduce((acc, key) => {
            const val = (req.body as Record<string, unknown>)[key];
            return acc + key + (val == null ? '' : String(val));
        }, '');

    const expected = crypto
        .createHmac('sha1', authToken)
        .update(Buffer.from(`https://${host}${req.originalUrl}` + params, 'utf8'))
        .digest('base64');

    const received = String(req.headers[TWILIO_SIGNATURE_HEADER]);
    return safeHexEqual(received, expected);
};

/**
 * Signature verification for POST /api/whatsapp/inbound.
 * - Meta Cloud API payloads: validated via X-Hub-Signature-256 (HMAC-SHA256 of raw body with META_APP_SECRET).
 * - Twilio WhatsApp payloads: validated via X-Twilio-Signature when the Meta header is absent.
 * - Fail-closed in every environment. Local unsigned testing requires the explicit
 *   opt-in ALLOW_UNSIGNED_WEBHOOKS_FOR_LOCAL_DEV=true (never set in staging/prod).
 */
export const verifyInboundWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
    const metaSecret = process.env.META_APP_SECRET;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;

    if (!metaSecret && !twilioToken) {
        if (process.env.ALLOW_UNSIGNED_WEBHOOKS_FOR_LOCAL_DEV === 'true' && process.env.NODE_ENV !== 'production') {
            logger.warn('Inbound webhook without provider secret allowed only via explicit local-dev opt-in');
            next();
            return;
        }
        logger.crit('META_APP_SECRET/TWILIO_AUTH_TOKEN not set — rejecting unsigned inbound webhook');
        res.status(503).json({ success: false, error: 'Webhook signature verification is not configured' });
        return;
    }

    const metaHeader = req.headers[META_SIGNATURE_HEADER];
    const twilioHeader = req.headers[TWILIO_SIGNATURE_HEADER];

    // Meta Cloud API path: requires raw body buffer
    if (metaSecret && typeof metaHeader === 'string') {
        const rawBody = req.rawBody;
        if (!Buffer.isBuffer(rawBody)) {
            logger.warn('Inbound webhook rejected — raw body unavailable for Meta signature verification');
            res.status(400).json({ success: false, error: 'Invalid request body' });
            return;
        }
        if (verifyMetaSignature(rawBody, metaHeader, metaSecret)) {
            next();
            return;
        }
        logger.warn(`Inbound webhook rejected — invalid ${META_SIGNATURE_HEADER}`);
        res.status(403).json({ success: false, error: 'Webhook signature verification failed' });
        return;
    }

    // Twilio WhatsApp path: signs URL + sorted body params
    if (twilioToken && typeof twilioHeader === 'string') {
        if (verifyTwilioSignature(req, twilioToken)) {
            next();
            return;
        }
        logger.warn('Inbound webhook rejected — invalid X-Twilio-Signature');
        res.status(403).json({ success: false, error: 'Webhook signature verification failed' });
        return;
    }

    logger.warn('Inbound webhook rejected — missing provider signature header');
    res.status(403).json({ success: false, error: 'Webhook signature verification failed' });
};
