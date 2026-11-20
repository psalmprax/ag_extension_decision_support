/**
 * Inbound SMS that are not farmer messages for the officer: MORE (the rest of a long
 * reply), LANG (a farmer's language), and commands from officers' and managers' phones.
 * Staff numbers are checked first so an officer is never sent the farmer sign-up questions.
 */
import { logger } from '@/utils/logger';
import { query } from '@/services/databaseService';
import { onboardingEngine } from '@/services/onboardingEngine';
import { claimInboundEvent } from '@/services/chat/channelInbound';
import { smsService } from '@/services/smsService';
import { findStaffByPhone } from './officerSmsAccess';
import { handleOfficerSms } from './officerSmsCommands';
import { isMoreCommand, sendMore } from './smsReply';
import { smsCopy } from './smsCopy';

const LANG_COMMAND = /^\s*(?:lang|lugha|language)\b\s*(\w*)\s*$/i;

function inBackground(label: string, work: () => Promise<unknown>): void {
    setImmediate(() => {
        work().catch(error => logger.error(`Inbound SMS (${label}) failed:`, error));
    });
}

/** Handle the message if it is one of these; false means carry on with farmer handling. */
export async function routeSpecialSms(from: string, text: string, eventId?: string): Promise<boolean> {
    const staff = await findStaffByPhone(from);
    const lang = LANG_COMMAND.exec(text);
    const more = isMoreCommand(text);
    if (!staff && !lang && !more) return false;
    // A gateway retry of a command must not run it twice (a second reply to a farmer).
    if (eventId && !(await claimInboundEvent('sms', from, eventId))) return true;

    if (staff) {
        inBackground('staff command', () => handleOfficerSms(staff, from, text));
        return true;
    }
    const farmer = await onboardingEngine.findFarmerByIdentifier(from, 'sms');
    if (more) {
        inBackground('more', () => sendMore(from, farmer?.language_preference, farmer?.id));
        return true;
    }
    const code = lang?.[1]?.toLowerCase();
    const chosen = code === 'sw' || code === 'kiswahili' ? 'sw' : code === 'en' || code === 'english' ? 'en' : null;
    inBackground('language', async () => {
        if (farmer && chosen) await query('UPDATE farmers SET language_preference = $2 WHERE id = $1', [farmer.id, chosen]);
        const reply = farmer && chosen ? smsCopy('lang_set', chosen) : smsCopy('lang_usage', farmer?.language_preference);
        await smsService.sendSMS({ to: from, message: reply, farmerId: farmer?.id });
    });
    return true;
}
