/**
 * Inbound SMS that are not farmer messages for the officer: MORE (the rest of a long
 * reply), LANG (a farmer's language), STOP and START (notices), and commands from
 * officers' and managers' phones.
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
import { applyOptCommand, optCommand } from '@/services/notify/optOut';
import { claimPilotEvent, mayBePilotReply, takePilotReply } from '@/services/pilots/pilotReplies';

const LANG_COMMAND = /^\s*(?:lang|lugha|language)\b\s*(\w*)\s*$/i;

function inBackground(label: string, work: () => Promise<unknown>): void {
    setImmediate(() => {
        work().catch(error => logger.error(`Inbound SMS (${label}) failed:`, error));
    });
}

/**
 * A pilot farmer's harvest (YIELD 900) or answer to "did you follow the advice?". Claimed under
 * its own key: a gateway retry is not recorded twice, and a message that turns out not to be
 * a pilot reply still reaches the farmer's thread.
 */
async function handledAsPilotReply(from: string, text: string, eventId?: string): Promise<boolean> {
    if (!mayBePilotReply(text)) return false;
    const farmer = await onboardingEngine.findFarmerByIdentifier(from, 'sms');
    if (!farmer) return false;
    if (eventId && !(await claimPilotEvent(from, eventId))) return true;
    return takePilotReply(String(farmer.id), text);
}

/** Handle the message if it is one of these; false means carry on with farmer handling. */
export async function routeSpecialSms(from: string, text: string, eventId?: string): Promise<boolean> {
    const staff = await findStaffByPhone(from);
    const lang = LANG_COMMAND.exec(text);
    const more = isMoreCommand(text);
    if (!staff && await handledAsPilotReply(from, text, eventId)) return true;
    // START is also the sign-up word: only a registered farmer's STOP or START is handled here.
    const optFarmer = !staff && optCommand(text) ? await onboardingEngine.findFarmerByIdentifier(from, 'sms') : null;
    const opt = optFarmer ? optCommand(text) : null;
    if (!staff && !lang && !more && !opt) return false;
    // A gateway retry of a command must not run it twice (a second reply to a farmer).
    if (eventId && !(await claimInboundEvent('sms', from, eventId))) return true;

    if (staff) {
        inBackground('staff command', () => handleOfficerSms(staff, from, text));
        return true;
    }
    const farmer = await onboardingEngine.findFarmerByIdentifier(from, 'sms');
    if (opt && optFarmer) {
        inBackground('stop or start', () => applyOptCommand(String(optFarmer.id), opt));
        return true;
    }
    if (more) {
        inBackground('more', () => sendMore(from, farmer?.language_preference, farmer?.id));
        return true;
    }
    const code = lang?.[1]?.toLowerCase();
    const NAMES: Record<string, string> = { sw: 'sw', kiswahili: 'sw', en: 'en', english: 'en', fr: 'fr', francais: 'fr', 'français': 'fr', pt: 'pt', portugues: 'pt', 'português': 'pt' };
    const chosen = code ? NAMES[code] ?? null : null;
    inBackground('language', async () => {
        if (farmer && chosen) await query('UPDATE farmers SET language_preference = $2 WHERE id = $1', [farmer.id, chosen]);
        const reply = farmer && chosen ? smsCopy('lang_set', chosen) : smsCopy('lang_usage', farmer?.language_preference);
        await smsService.sendSMS({ to: from, message: reply, farmerId: farmer?.id });
    });
    return true;
}
