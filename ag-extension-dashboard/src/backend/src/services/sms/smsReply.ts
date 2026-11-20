/**
 * Replies by SMS that respect the two-part rule: a long answer is cut after two parts
 * with a MORE prompt, and the rest waits until the person replies MORE.
 */
import { query } from '@/services/databaseService';
import { smsService } from '@/services/smsService';
import { splitForSms } from './smsText';
import { smsCopy } from './smsCopy';

const phoneKey = (phone: string) => smsService.formatPhoneNumber(phone);

async function saveRest(phone: string, rest: string | null): Promise<void> {
    if (rest) {
        await query(
            `INSERT INTO sms_continuations (phone, remaining, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (phone) DO UPDATE SET remaining = EXCLUDED.remaining, updated_at = NOW()`,
            [phoneKey(phone), rest],
        );
    } else {
        await query('DELETE FROM sms_continuations WHERE phone = $1', [phoneKey(phone)]);
    }
}

/** Send a reply of at most two SMS parts; anything longer waits for MORE. */
export async function sendSmsReply(params: {
    to: string;
    text: string;
    language?: string | null;
    farmerId?: string;
    senderId?: string;
}): Promise<boolean> {
    const { send, rest } = splitForSms(params.text, smsCopy('more_prompt', params.language));
    const sent = await smsService.sendSMS({ to: params.to, message: send, farmerId: params.farmerId, senderId: params.senderId });
    if (sent) await saveRest(params.to, rest);
    return sent;
}

/** True when the text is a request for the rest of the last reply. */
export function isMoreCommand(text: string): boolean {
    return /^\s*(more|zaidi)\s*[.!]?\s*$/i.test(text);
}

/** Send the next two parts of the last long reply (kept for 7 days), or say there is none. */
export async function sendMore(phone: string, language?: string | null, farmerId?: string): Promise<boolean> {
    const { rows } = await query<{ remaining: string }>(
        `DELETE FROM sms_continuations WHERE phone = $1 AND updated_at > NOW() - INTERVAL '7 days' RETURNING remaining`,
        [phoneKey(phone)],
    );
    const remaining = rows[0]?.remaining;
    if (!remaining) return smsService.sendSMS({ to: phone, message: smsCopy('more_nothing', language), farmerId });
    return sendSmsReply({ to: phone, text: remaining, language, farmerId });
}
