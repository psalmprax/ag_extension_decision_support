import { Router, Response } from 'express';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { checkMessageAccess } from '@/services/messageAccessService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

const pstnSchema = z.object({
  to: z.string().regex(/^\+?[0-9\s\-().]{7,22}$/),
  message: z.string().min(1).max(500).optional(),
  farmerId: z.string().uuid().optional(),
  url: z.string().url().optional(),
});

router.post('/pstn', validate({ body: pstnSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const { to, message, farmerId, url } = req.body as z.infer<typeof pstnSchema>;
    await checkMessageAccess(req.user!, { farmerId, phone: to });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      return res.status(503).json({ success: false, error: 'PSTN provider not configured' });
    }

    const twiml = message
      ? `<Response><Say voice="alice" language="en-US">${message.replace(/[<>&]/g, '')}</Say><Gather numDigits="1" timeout="8"><Say>Press any key to confirm receipt.</Say></Gather></Response>`
      : undefined;

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from });
    if (twiml) params.set('Twiml', twiml);
    else if (url) params.set('Url', url);
    else return res.status(400).json({ success: false, error: 'message or url required' });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await resp.json() as { sid?: string; status?: string; error_message?: string };
    if (!resp.ok) {
      logger.error('PSTN call failed:', data);
      return safeError(res, 502, data.error_message || 'PSTN provider rejected the call');
    }
    logger.info(`PSTN call initiated to ${to} sid=${data.sid}`);
    return res.json({ success: true, data: { callSid: data.sid, status: data.status } });
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) return safeError(res, (e as { statusCode: number }).statusCode, (e as Error).message);
    logger.error('PSTN call error:', e);
    return safeError(res, 500, 'PSTN call failed');
  }
});

export default router;
