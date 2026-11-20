/**
 * POST /api/auth/phone/request  { phone }        → sends a 6-digit code by SMS
 * POST /api/auth/phone/verify   { phone, code }  → signs in (or asks for two-factor)
 *
 * The request step answers the same way whether or not the number is known, so it cannot
 * be used to find out who has an account.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { safeError } from '@/utils/safeResponse';
import { recordLoginAttempt, resolveLocationFromHeaders } from '@/services/loginHistoryService';
import {
    accountForPhone,
    checkLoginCode,
    CODE_TTL_MINUTES,
    createFarmerAccountForPhone,
    normalisePhone,
    requestLoginCode,
} from '@/services/phoneLoginService';
import { finishSignIn } from './loginCompletion';

const router = Router();

const requestSchema = z.object({ body: z.object({ phone: z.string().min(7).max(25), country: z.string().max(60).optional() }) });
const verifySchema = z.object({
    body: z.object({ phone: z.string().min(7).max(25), country: z.string().max(60).optional(), code: z.string().regex(/^\s*\d{6}\s*$/) }),
});

const clientIpOf = (req: Request) =>
    req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || null;

router.post('/phone/request', validate(requestSchema), async (req: Request, res: Response) => {
    const phone = normalisePhone(req.body.phone, req.body.country);
    if (!phone) return res.status(400).json({ success: false, error: 'Enter the phone number with its country code, for example +254 712 345 678.' });
    try {
        const outcome = await requestLoginCode(phone, clientIpOf(req));
        if (outcome === 'rate_limited') {
            return res.status(429).json({ success: false, error: 'Too many codes were requested. Wait 15 minutes and try again.' });
        }
        if (outcome === 'send_failed') logger.warn('Phone sign-in code could not be sent');
        return res.json({
            success: true,
            data: { message: `If this number is registered, a code is on its way. It expires in ${CODE_TTL_MINUTES} minutes.` },
        });
    } catch (error) {
        logger.error('Phone sign-in request failed:', error);
        return safeError(res, 500, 'Could not send a code');
    }
});

router.post('/phone/verify', [auditMiddleware('auth_login'), validate(verifySchema)], async (req: Request, res: Response) => {
    const phone = normalisePhone(req.body.phone, req.body.country);
    if (!phone) return res.status(400).json({ success: false, error: 'Enter the phone number with its country code.' });
    const clientIp = clientIpOf(req);
    try {
        const outcome = await checkLoginCode(phone, req.body.code);
        if (outcome !== 'ok') {
            await recordLoginAttempt({
                email: phone, status: 'failed', failureReason: `phone_code_${outcome}`, ipAddress: clientIp,
                userAgent: req.get('user-agent'), location: resolveLocationFromHeaders(req.headers, clientIp),
            });
            const error = outcome === 'expired'
                ? 'That code has expired. Ask for a new one.'
                : outcome === 'too_many_attempts'
                    ? 'Too many wrong codes. Ask for a new one.'
                    : 'That code is not right. Check the SMS and try again.';
            return res.status(401).json({ success: false, error });
        }
        const user = (await accountForPhone(phone)) ?? (await createFarmerAccountForPhone(phone));
        if (!user) return res.status(401).json({ success: false, error: 'No account uses this number.' });
        await finishSignIn(req, res, user, clientIp);
    } catch (error) {
        logger.error('Phone sign-in failed:', error);
        safeError(res, 500, 'Sign-in failed');
    }
});

export default router;
