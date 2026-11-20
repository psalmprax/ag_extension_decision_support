/**
 * Africa's Talking voice callback for the voice question line (services/voice/voiceLine).
 * Set the number's callback URL to /api/v1/voice-line/callback?key=<AFRICASTALKING_WEBHOOK_SECRET>.
 * Off unless VOICE_LINE_ENABLED=true, so a number is never answered by accident.
 */
import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { verifySmsGatewayWebhook } from '@/middleware/webhookSignature';
import { answerCall, takeRecording, thanksXml, type VoiceCallback } from '@/services/voice/voiceLine';

const router = Router();

router.post('/callback', verifySmsGatewayWebhook, async (req: Request, res: Response) => {
    if (process.env.VOICE_LINE_ENABLED !== 'true') {
        return res.status(503).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
    }
    const callback = req.body as VoiceCallback;
    if (callback.recordingUrl) {
        // The recording arrives once the caller presses # or hangs up; file it after answering.
        setImmediate(() => {
            takeRecording(callback).catch(error => logger.error(`Voice line call ${callback.sessionId ?? '-'} could not be filed:`, error));
        });
    }
    if (callback.isActive === '0') return res.status(200).end();
    if (callback.recordingUrl) return res.status(200).type('application/xml').send(await thanksXml(callback.callerNumber));
    try {
        return res.status(200).type('application/xml').send(await answerCall(callback));
    } catch (error) {
        logger.error('Voice line answer failed:', error);
        return res.status(200).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, the line is not working. Please send an SMS instead.</Say></Response>');
    }
});

export default router;
