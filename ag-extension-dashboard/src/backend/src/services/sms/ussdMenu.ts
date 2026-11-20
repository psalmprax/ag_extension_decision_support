/**
 * The USSD menu (Africa's Talking format: `text` holds every answer so far, joined by *).
 * USSD sessions close within seconds, so anything that needs the AI or an officer is
 * taken here and answered later by SMS.
 */
import { logger } from '@/utils/logger';
import { query } from '@/services/databaseService';
import { onboardingEngine } from '@/services/onboardingEngine';
import { handleRegisteredFarmerChannelMessage } from '@/services/chat/channelInbound';
import { messagingKnowledgeReply } from '@/services/knowledge/messagingHints';
import { smsService } from '@/services/smsService';
import { smsCopy } from './smsCopy';
import { USSD_LANGUAGE_CODES, con, end, numbered, pick } from './ussdText';
import { findStaffByPhone } from './officerSmsAccess';
import { staffUssd } from './ussdStaff';
import { marketLines, weatherLine } from './ussdInfo';

interface UssdFarmer {
    id: string;
    first_name: string | null;
    language_preference: string | null;
    region: string | null;
    district: string | null;
    country: string | null;
}

/** Run work after the USSD screen has been returned (the session cannot wait for it). */
function later(label: string, work: () => Promise<unknown>): void {
    setImmediate(() => {
        work().catch(error => logger.error(`USSD follow-up failed (${label}):`, error));
    });
}

const askAiLater = (farmerId: string, question: string, language: string | null) =>
    later('ask', () => handleRegisteredFarmerChannelMessage({ farmerId, channel: 'sms', text: `ASK AI ${question}`, language: language ?? undefined }));

type FarmerOption = (farmer: UssdFarmer, rest: string[]) => Promise<string> | string;

function askQuestion(farmer: UssdFarmer, rest: string[]): string {
    const lang = farmer.language_preference;
    const question = rest.join('*').trim();
    if (!question) return con(smsCopy('ussd_type_question', lang));
    askAiLater(farmer.id, question, lang);
    return end(smsCopy('ussd_answer_by_sms', lang));
}

/** Crop, then part of the plant, then what the farmer sees; answered by SMS. */
function cropProblem(farmer: UssdFarmer, rest: string[]): string {
    const lang = farmer.language_preference;
    const steps = [
        { list: 'crops', prompt: smsCopy('diag_crop', lang) },
        { list: 'parts', prompt: smsCopy('diag_part', lang) },
        { list: 'symptoms', prompt: smsCopy('diag_symptom', lang) },
    ] as const;
    const picked: string[] = [];
    for (const [index, step] of steps.entries()) {
        if (!rest[index]) return con(`${step.prompt}\n${numbered(step.list, lang)}`);
        const choice = pick(step.list, lang, rest[index]);
        if (!choice) return end(smsCopy('ussd_invalid', lang));
        picked.push(choice);
    }
    const [crop, part, symptom] = picked;
    askAiLater(farmer.id, `${crop}, ${part.toLowerCase()}: ${symptom.toLowerCase()}`, lang);
    return end(`${smsCopy('ussd_answer_by_sms', lang)} ${smsCopy('diag_confirm_note', lang)}`);
}

function messageOfficer(farmer: UssdFarmer, rest: string[]): string {
    const lang = farmer.language_preference;
    const message = rest.join('*').trim();
    if (!message) return con(smsCopy('ussd_type_message', lang));
    later('officer message', () =>
        handleRegisteredFarmerChannelMessage({ farmerId: farmer.id, channel: 'sms', text: message, language: lang ?? undefined }));
    return end(smsCopy('ussd_sent_to_officer', lang));
}

async function chooseLanguage(farmer: UssdFarmer, rest: string[]): Promise<string> {
    const lang = farmer.language_preference;
    if (!rest[0]) return con(numbered('languages', lang));
    const code = USSD_LANGUAGE_CODES[Number.parseInt(rest[0], 10) - 1] ?? null;
    if (!code) return end(smsCopy('ussd_invalid', lang));
    await query('UPDATE farmers SET language_preference = $2 WHERE id = $1', [farmer.id, code]);
    return end(smsCopy('lang_set', code));
}

const FARMER_OPTIONS: Record<string, FarmerOption> = {
    '1': askQuestion,
    '2': cropProblem,
    '3': async farmer => end(await weatherLine(farmer.district || farmer.region, farmer.language_preference)),
    '4': async farmer => end(await marketLines(farmer.country, farmer.language_preference)),
    '5': messageOfficer,
    '6': chooseLanguage,
};

async function farmerMenu(farmer: UssdFarmer, steps: string[]): Promise<string> {
    const [choice, ...rest] = steps;
    if (!choice) return con(`${farmer.first_name ? `${farmer.first_name}\n` : ''}${numbered('farmer', farmer.language_preference)}`);
    const option = FARMER_OPTIONS[choice];
    return option ? option(farmer, rest) : end(smsCopy('ussd_invalid', farmer.language_preference));
}

async function visitorMenu(phone: string, steps: string[]): Promise<string> {
    const [choice, ...rest] = steps;
    if (!choice) return con(numbered('visitor', 'en'));
    switch (choice) {
        case '1':
            later('register', async () => {
                const started = await onboardingEngine.processIncomingMessage({ channel: 'sms', identifier: phone, message: 'START' });
                if (started.responseMessage) await smsService.sendSMS({ to: phone, message: started.responseMessage });
            });
            return end(smsCopy('ussd_register_sms', 'en'));
        case '2': {
            const question = rest.join('*').trim();
            if (!question) return con(smsCopy('ussd_type_question', 'en'));
            later('hint', async () => smsService.sendSMS({ to: phone, message: await messagingKnowledgeReply(question) }));
            return end(smsCopy('ussd_answer_by_sms', 'en'));
        }
        case '3':
            return end(await weatherLine(null, 'en'));
        case '4':
            return end(await marketLines(null, 'en'));
        default:
            return end(smsCopy('ussd_invalid', 'en'));
    }
}

/** The next USSD screen for a phone number and the answers given so far. */
export async function ussdScreen(phoneNumber: string, text: string): Promise<string> {
    const steps = text ? text.split('*') : [];
    const staff = await findStaffByPhone(phoneNumber);
    if (staff) return staffUssd(staff, phoneNumber, steps, later);
    const farmer = (await onboardingEngine.findFarmerByIdentifier(phoneNumber, 'sms')) as UssdFarmer | null;
    return farmer ? farmerMenu(farmer, steps) : visitorMenu(phoneNumber, steps);
}
