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
    // Twilio spec: HMAC-SHA1 over (full request URL + sorted "keyvalue" concatenation of POST params)
    const rawProto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const proto = rawProto.split(',')[0].trim();
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
    const host = rawHost.split(',')[0].trim();
    const params = Object.keys(req.body ?? {})
        .sort()
        .reduce((acc, key) => {
            const val = (req.body as Record<string, unknown>)[key];
            return acc + key + (val == null ? '' : String(val));
        }, '');

    const computeExpected = (p: string, h: string) => crypto
        .createHmac('sha1', authToken)
        .update(Buffer.from(`${p}://${h}${req.originalUrl}` + params, 'utf8'))
        .digest('base64');

    const received = String(req.headers[TWILIO_SIGNATURE_HEADER]);
    const hosts = [host];
    const stripped = host.replace(/:(443|80)$/, '');
    if (stripped !== host) hosts.push(stripped);

    const protos = [proto, proto === 'https' ? 'http' : 'https'];
    for (const p of protos) {
        for (const h of hosts) {
            if (safeHexEqual(received, computeExpected(p, h))) return true;
        }
    }
    return false;
};

/**
 * Signature verification for POST /api/whatsapp/inbound.
 * - Meta Cloud API payloads: validated via X-Hub-Signature-256 (HMAC-SHA256 of raw body with META_APP_SECRET).
 * - Twilio WhatsApp payloads: validated via X-Twilio-Signature when the Meta header is absent.
 * - Production without any provider secret configured refuses traffic; dev allows with a warning.
 */
export const verifyInboundWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
    const metaSecret = process.env.META_APP_SECRET;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!metaSecret && !twilioToken) {
        if (isProduction) {
            logger.crit('META_APP_SECRET/TWILIO_AUTH_TOKEN not set in production — rejecting unsigned inbound webhook');
            res.status(503).json({ success: false, error: 'Webhook signature verification is not configured' });
            return;
        }
        logger.warn('Inbound webhook received without any provider secret configured — skipping signature check (dev only)');
        next();
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
