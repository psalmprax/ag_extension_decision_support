import { logger } from '../utils/logger';

export interface IvrCallOptions {
  alertTitle: string;
  advisorySwahili: string;
  advisoryEnglish?: string;
  officerContact?: string;
  repeatAllowed?: boolean;
}

export interface DtmfActionResponse {
  action: 'repeat' | 'request_officer_visit' | 'connect_agro_dealer' | 'confirm_receipt' | 'unknown';
  description: string;
  nextPromptXml: string;
}

export function generateIvrXml(options: IvrCallOptions): string {
  const { alertTitle, advisorySwahili, repeatAllowed = true } = options;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="sw-KE">
    Habari mkulima. Hii ni taarifa muhimu ya kilimo kuhusu ${alertTitle}.
    ${advisorySwahili}
  </Say>
  <Gather numDigits="1" timeout="10" finishOnKey="#">
    <Say voice="alice" language="sw-KE">
      Bonyeza moja kupokea maelezo kwa SMS.
      Bonyeza mbili kuomba afisa wa ugani akutembelee shambani.
      Bonyeza tatu kuunganishwa na muuzaji wa pembejeo aliyeidhinishwa.
      ${repeatAllowed ? 'Bonyeza sufuri kusikiliza tena.' : ''}
    </Say>
  </Gather>
  <Say voice="alice" language="sw-KE">Asante, kwaheri.</Say>
</Response>`.trim();
}

export function processDtmfResponse(digit: string): DtmfActionResponse {
  const cleanDigit = digit.trim();

  switch (cleanDigit) {
    case '1':
      return {
        action: 'confirm_receipt',
        description: 'Farmer requested full advisory summary via SMS',
        nextPromptXml: `<Response><Say voice="alice" language="sw-KE">Ujumbe wa SMS umetumwa kwenye simu yako. Asante!</Say></Response>`,
      };
    case '2':
      return {
        action: 'request_officer_visit',
        description: 'Farmer requested an on-farm diagnostic visit by an extension officer',
        nextPromptXml: `<Response><Say voice="alice" language="sw-KE">Ombi lako la kutembelewa na afisa wa nyanjani limepokelewa. Afisa atawasiliana nawe hivi karibuni.</Say></Response>`,
      };
    case '3':
      return {
        action: 'connect_agro_dealer',
        description: 'Farmer requested contact with nearest certified input stockist',
        nextPromptXml: `<Response><Say voice="alice" language="sw-KE">Tumekutumia orodha ya wauzaji wa mbolea na dawa walioidhinishwa walio karibu nawe kwa SMS.</Say></Response>`,
      };
    case '0':
      return {
        action: 'repeat',
        description: 'Farmer requested to replay audio broadcast',
        nextPromptXml: `<Response><Redirect>/api/v1/voice/ivr-replay</Redirect></Response>`,
      };
    default:
      return {
        action: 'unknown',
        description: `Unrecognized DTMF digit: ${cleanDigit}`,
        nextPromptXml: `<Response><Say voice="alice" language="sw-KE">Chaguo halitambuliki. Asante kwaheri.</Say></Response>`,
      };
  }
}

export async function dispatchVoiceBroadcast(params: {
  farmerPhones: string[];
  alertTitle: string;
  advisorySwahili: string;
  advisoryEnglish: string;
}): Promise<{ dispatchedCount: number; batchId: string; provider?: string; attempted?: number; failed?: number }> {
  const { farmerPhones, alertTitle, advisorySwahili, advisoryEnglish } = params;
  const batchId = `ivr_batch_${Date.now()}`;

  logger.info(`Starting IVR voice broadcast ${batchId} to ${farmerPhones.length} farmers for "${alertTitle}"`);

  // Generates XML prompt for the batch (served by TwiML callback; Africa's Talking uses same XML)
  const promptXml = generateIvrXml({
    alertTitle,
    advisorySwahili,
    advisoryEnglish,
  });

  logger.debug(`Generated IVR XML for batch ${batchId}: ${promptXml.slice(0, 120)}...`);

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const callbackBase = process.env.PUBLIC_BASE_URL || process.env.API_PUBLIC_URL || '';

  // If Twilio voice credentials + callback URL are present, actually place calls; otherwise log-only in dev/test.
  if (twilioSid && twilioToken && twilioFrom && callbackBase) {
    try {
      const axios = (await import('axios')).default;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const twimlUrl = `${callbackBase.replace(/\/$/, '')}/api/v1/voice/ivr?batchId=${encodeURIComponent(batchId)}`;
      let dispatched = 0;
      let failed = 0;
      for (const to of farmerPhones) {
        try {
          await axios.post(
            url,
            new URLSearchParams({ To: to, From: twilioFrom, Url: twimlUrl }).toString(),
            { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
          );
          dispatched++;
        } catch (e) {
          failed++;
          logger.warn(`IVR call to ${to} failed:`, e instanceof Error ? e.message : e);
        }
      }
      return { dispatchedCount: dispatched, batchId, provider: 'twilio', attempted: farmerPhones.length, failed };
    } catch (e) {
      logger.error('Twilio IVR dispatch error:', e);
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn('IVR broadcast running in log-only mode: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER/PUBLIC_BASE_URL not fully set');
  }

  return {
    dispatchedCount: farmerPhones.length,
    batchId,
    provider: 'log_only',
    attempted: farmerPhones.length,
  };
}
