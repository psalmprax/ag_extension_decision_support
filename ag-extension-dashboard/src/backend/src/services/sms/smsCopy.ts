/**
 * Fixed SMS and USSD texts in the languages farmers use. English is the fallback for a
 * language without a translation here. Kiswahili wording should be checked by a native
 * speaker before a launch in a new county.
 */
export type SmsLanguage = 'en' | 'sw';

const COPY = {
    ack_sms: {
        en: 'Thanks, your officer will reply. For an AI answer now, send ASK AI and your question.',
        sw: 'Asante, afisa wako atajibu. Kwa jibu la AI sasa, tuma ASK AI na swali lako.',
    },
    ack_no_ai: { en: 'Thanks, your officer will reply.', sw: 'Asante, afisa wako atajibu.' },
    ack_chat: {
        en: 'Thanks, your officer will reply, usually within {minutes} minutes in working hours. For an answer now, tap Ask AI or send ASK AI.',
        sw: 'Asante, afisa wako atajibu, kwa kawaida ndani ya dakika {minutes} saa za kazi. Kwa jibu sasa, bonyeza Ask AI au tuma ASK AI.',
    },
    ask_ai_usage: {
        en: 'Send your question after ASK AI. Example: ASK AI maize leaves turning yellow after rain.',
        sw: 'Tuma swali lako baada ya ASK AI. Mfano: ASK AI majani ya mahindi yanageuka manjano baada ya mvua.',
    },
    already_answered: {
        en: 'The AI has already answered your last question. Your officer will follow up.',
        sw: 'AI imeshajibu swali lako la mwisho. Afisa wako atafuatilia.',
    },
    sms_limit_reached: {
        en: "You have used today's AI answers by SMS. Your officer will reply.",
        sw: 'Umetumia majibu yote ya AI ya leo kwa SMS. Afisa wako atajibu.',
    },
    ai_not_on_plan: {
        en: 'AI answers are not included in your service plan. Your officer will reply.',
        sw: 'Majibu ya AI hayamo kwenye mpango wako wa huduma. Afisa wako atajibu.',
    },
    more_prompt: { en: 'Reply MORE for the rest.', sw: 'Tuma MORE kupata zaidi.' },
    more_nothing: { en: 'There is nothing more to send.', sw: 'Hakuna zaidi ya kutuma.' },
    lang_set: { en: 'Language set to English.', sw: 'Lugha imewekwa: Kiswahili.' },
    lang_usage: { en: 'Send LANG EN for English or LANG SW for Kiswahili.', sw: 'Tuma LANG SW kwa Kiswahili au LANG EN kwa Kiingereza.' },
    ussd_answer_by_sms: { en: 'Thanks. Your answer will arrive by SMS shortly.', sw: 'Asante. Jibu lako litafika kwa SMS hivi karibuni.' },
    ussd_sent_to_officer: { en: 'Sent to your officer. The reply will come by SMS.', sw: 'Imetumwa kwa afisa wako. Jibu litakuja kwa SMS.' },
    ussd_type_question: { en: 'Type your question:', sw: 'Andika swali lako:' },
    ussd_type_message: { en: 'Type your message to your officer:', sw: 'Andika ujumbe kwa afisa wako:' },
    ussd_invalid: { en: 'That option is not on the menu.', sw: 'Chaguo hilo halipo.' },
    ussd_register_sms: {
        en: 'We will text you to set up your profile. Reply to that SMS to continue.',
        sw: 'Tutakutumia SMS kuanza usajili. Jibu SMS hiyo kuendelea.',
    },
    ussd_not_registered_officer: {
        en: 'This number is not registered to an officer account.',
        sw: 'Nambari hii haijasajiliwa kwa akaunti ya afisa.',
    },
    login_code: {
        en: '{code} is your GPExts sign-in code. It expires in {minutes} minutes. Do not share it with anyone.',
        sw: '{code} ni nambari yako ya kuingia GPExts. Itaisha baada ya dakika {minutes}. Usimpe mtu yeyote.',
    },
    diag_crop: { en: 'Which crop?', sw: 'Zao gani?' },
    diag_part: { en: 'Which part of the plant?', sw: 'Sehemu gani ya mmea?' },
    diag_symptom: { en: 'What do you see?', sw: 'Unaona nini?' },
    diag_confirm_note: {
        en: 'This is a first answer. Your officer will confirm it.',
        sw: 'Hili ni jibu la awali. Afisa wako atalithibitisha.',
    },
} as const satisfies Record<string, Record<SmsLanguage, string>>;

export type SmsCopyKey = keyof typeof COPY;

export function smsLanguage(preference: string | null | undefined): SmsLanguage {
    return preference?.toLowerCase().startsWith('sw') ? 'sw' : 'en';
}

export function smsCopy(key: SmsCopyKey, language: string | null | undefined): string {
    return COPY[key][smsLanguage(language)];
}
