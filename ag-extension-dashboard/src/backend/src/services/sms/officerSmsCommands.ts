/**
 * SMS commands for extension officers and regional managers, from the phone number on
 * their account. Commands other than HELP and PIN need the PIN once a day.
 *
 *   PIN 4821                 unlock commands for 24 hours (LOCK ends it early)
 *   INBOX                    the three newest unanswered farmer messages, numbered
 *   R 12 <reply>             reply to farmer 12 (goes to them on their channel)
 *   FIND <name>              farmers whose name matches, numbered
 *   VISIT 12 <notes>         record a visit to farmer 12 today (DONE is optional); on WhatsApp,
 *                            photos, video or a dictated voice note sent with it join the report
 *   PLAN 12 <date> <notes>   schedule a visit (today, tomorrow, Tue, 25/11); the farmer is told
 *   REG <phone> <name>, <crop>, <village>   register a farmer, who gets a confirmation
 *   ASK AI <question>        an AI answer by SMS
 */
import { logger } from '@/utils/logger';
import { generateAdvisoryAnswer } from '@/services/chat/advisoryAnswer';
import { usageService } from '@/services/usageService';
import { postOfficerReply } from '@/services/chat/threadPost';
import { sendSmsReply } from './smsReply';
import { type SmsStaff, isUnlocked, lockSmsCommands, tryPin } from './officerSmsAccess';
import { farmerForRef, findFarmers, recordSmsVisit, threadForFarmer, unansweredThreads } from './officerSmsData';
import { parseSmsDate } from './smsDate';
import { timeZoneFor, writesMonthFirst } from '@/services/country/localTime';
import { noticeInBackground, notifyVisitChange } from '@/services/notify/farmerNotices';
import { registerFarmerBySms } from './officerRegister';
import { storeFarmerMedia, type InboundMedia } from '@/services/chat/inboundMedia';
import { linkAttachments } from '@/services/uploadAttachments';
import { withEnglishSummary } from '@/services/visits/dictatedNotes';

export const OFFICER_HELP =
    'Commands: INBOX, R 12 reply, FIND name, VISIT 12 notes, PLAN 12 Tue notes, REG phone name, crop, village, ASK AI question, LOCK. ' +
    'Send PIN and your 4 digits first each day.';

const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text);

async function inbox(staff: SmsStaff): Promise<string> {
    const items = await unansweredThreads(staff);
    if (items.length === 0) return 'No farmer messages are waiting for a reply.';
    const lines = items.map(item => `${item.ref} ${item.name} (${item.hoursAgo}h): ${short(item.text.replace(/\s+/g, ' '), 70)}`);
    return `${lines.join('\n')}\nReply: R <number> <message>`;
}

async function reply(staff: SmsStaff, ref: number, text: string): Promise<string> {
    if (!text) return 'Add your reply after the number, for example: R 12 I will visit on Tuesday.';
    const farmer = await farmerForRef(staff, ref);
    if (!farmer) return `No farmer ${ref} in your list. Send INBOX or FIND <name> first.`;
    const conversationId = await threadForFarmer(farmer.id);
    await postOfficerReply(conversationId, text, staff.id);
    return `Sent to ${farmer.name}.`;
}

async function find(staff: SmsStaff, text: string): Promise<string> {
    if (text.length < 2) return 'Send FIND and part of a name, for example: FIND Njeri';
    const farmers = await findFarmers(staff, text);
    if (farmers.length === 0) return `No farmer matching "${short(text, 30)}" in your list.`;
    return farmers.map(f => `${f.ref} ${f.name}`).join('\n');
}

async function visit(staff: SmsStaff, ref: number, text: string, extras: CommandExtras = {}): Promise<string> {
    const farmer = await farmerForRef(staff, ref);
    if (!farmer) return `No farmer ${ref} in your list. Send FIND <name> first.`;
    const spoken = text.replace(/^[\s,.:-]*(done|imekamilika)\b\s*/i, '').replace(/^[\s,.:-]+/, '').trim();
    const notes = await withEnglishSummary(spoken, extras.spokenLanguage, staff.id);
    const visitId = await recordSmsVisit({ staffId: staff.id, farmer, status: 'completed', when: new Date(), notes });
    // Photos, video or the voice note sent with VISIT on WhatsApp go in the visit report.
    const kept = await storeFarmerMedia(farmer.id, extras.media ?? [], staff.id);
    await linkAttachments('visit', visitId, kept);
    const files = kept.length ? ` and ${kept.length} file${kept.length > 1 ? 's' : ''}` : '';
    return `Visit to ${farmer.name} recorded for today${notes ? ' with your notes' : ''}${files}.${kept.length ? '' : ' Add photos or more detail in the app.'}`;
}

async function plan(staff: SmsStaff, ref: number, text: string): Promise<string> {
    const farmer = await farmerForRef(staff, ref);
    if (!farmer) return `No farmer ${ref} in your list. Send FIND <name> first.`;
    const timeZone = timeZoneFor({ timeZone: staff.time_zone, country: staff.country });
    const monthFirst = writesMonthFirst(staff.country);
    const parsed = parseSmsDate(text, new Date(), { timeZone, monthFirst });
    if (!parsed) return `Add a date after the number: today, tomorrow, a weekday like Tue, or ${monthFirst ? '11/25' : '25/11'}.`;
    const visitId = await recordSmsVisit({ staffId: staff.id, farmer, status: 'scheduled', when: parsed.date, notes: parsed.rest });
    noticeInBackground('visit planned', () => notifyVisitChange(visitId, 'planned'));
    const shown = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed.date);
    return `Visit to ${farmer.name} planned for ${shown}. They are told by SMS unless they have turned notices off.`;
}

/** An AI answer for a staff member by SMS or USSD, counted against their plan's AI quota. */
export async function staffAiAnswer(staff: SmsStaff, question: string): Promise<string> {
    if (!question) return 'Send your question after ASK AI.';
    const limit = await usageService.checkLimit(staff.id, 'ai_chat');
    if (!limit.allowed) return 'Your plan has no AI answers left this month. Ask in the app or contact your administrator.';
    const answer = await generateAdvisoryAnswer({
        message: question,
        requester: { userId: staff.id, role: staff.role },
        brevity: 'sms',
    });
    await usageService.incrementUsage(staff.id, 'ai_chat').catch(error => logger.warn('Failed to meter SMS AI answer:', error));
    return answer.text;
}

/** What came with the command besides its text: files sent on WhatsApp. */
export interface CommandExtras {
    media?: InboundMedia[];
    /** The language of a dictated voice note, when the command came as one. */
    spokenLanguage?: string;
}

type RefCommand = (staff: SmsStaff, ref: number, text: string, extras?: CommandExtras) => Promise<string>;
type TextCommand = (staff: SmsStaff, text: string) => Promise<string>;

/** Commands that act on a farmer number (R 12 ..., VISIT 12 ..., PLAN 12 ...). */
const REF_COMMANDS: Record<string, RefCommand> = {
    R: reply, REPLY: reply, JIBU: reply,
    VISIT: visit, ZIARA: visit,
    PLAN: plan, PANGA: plan,
};

/** Commands that take free text. */
const TEXT_COMMANDS: Record<string, TextCommand> = {
    INBOX: staff => inbox(staff),
    NEW: staff => inbox(staff),
    FIND: find,
    TAFUTA: find,
    REG: registerFarmerBySms,
    SAJILI: registerFarmerBySms,
    ASK: (staff, text) => staffAiAnswer(staff, text.replace(/^ai\b\s*[:,.-]?\s*/i, '').trim()),
    ULIZA: (staff, text) => staffAiAnswer(staff, text.replace(/^ai\b\s*[:,.-]?\s*/i, '').trim()),
    LOCK: async staff => {
        await lockSmsCommands(staff.id);
        return 'Locked. Send PIN to unlock again.';
    },
};

const LOCKED_TEXT = 'SMS commands are locked after too many wrong PINs. Set a new PIN in the app.';

async function pinReply(staff: SmsStaff, pin: string): Promise<string> {
    const outcome = await tryPin(staff, pin);
    if (outcome === 'unlocked') return 'Unlocked for 24 hours. Send INBOX to see waiting messages.';
    if (outcome === 'no_pin') return 'Set your SMS PIN first: in the app under Settings, or by USSD.';
    if (outcome === 'locked') return LOCKED_TEXT;
    return 'Wrong PIN.';
}

/** Work out the reply to one SMS from a staff number. */
export async function officerCommandReply(staff: SmsStaff, rawText: string, extras: CommandExtras = {}): Promise<string> {
    const [word = '', ...restWords] = rawText.trim().split(/\s+/);
    // A dictated command may come back from transcription as "Visit 12, ..." or "Visit." .
    const command = word.toUpperCase().replace(/[^\p{L}]/gu, '');
    const rest = restWords.join(' ');

    if (command === 'HELP' || command === 'MSAADA') return OFFICER_HELP;
    if (command === 'PIN') return pinReply(staff, rest.trim());
    if (staff.sms_pin_locked) return LOCKED_TEXT;
    if (!isUnlocked(staff)) return 'Send PIN and your 4 digits to use SMS commands.';

    const textCommand = TEXT_COMMANDS[command];
    if (textCommand) return textCommand(staff, rest);
    const refCommand = REF_COMMANDS[command];
    if (!refCommand) return OFFICER_HELP;
    const ref = Number.parseInt(restWords[0] ?? '', 10);
    if (!Number.isInteger(ref)) return `Add the farmer's number after ${command}, for example: ${command} 12 ...`;
    return refCommand(staff, ref, restWords.slice(1).join(' '), extras);
}

/** Handle one SMS from a staff number and text back the result. */
export async function handleOfficerSms(staff: SmsStaff, phone: string, text: string): Promise<void> {
    let message: string;
    try {
        message = await officerCommandReply(staff, text);
    } catch (error) {
        logger.error('Officer SMS command failed:', error);
        message = 'That did not work. Please try again or use the app.';
    }
    await sendSmsReply({ to: phone, text: message, senderId: staff.id });
}
