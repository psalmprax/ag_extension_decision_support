/**
 * Fixed SMS and USSD texts in the languages farmers use. English is the fallback for a
 * language without a translation here. Kiswahili, French and Portuguese wording should be
 * checked by a native speaker before a launch in a new area. Languages are added only
 * with wording a person has written or checked, never machine output sent unseen.
 */
export type SmsLanguage = 'en' | 'sw' | 'fr' | 'pt';
/** Languages the SMS and USSD copy is written in. */
export const SMS_LANGUAGES: readonly SmsLanguage[] = ['en', 'sw', 'fr', 'pt'];

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
} as const satisfies Record<string, Record<'en' | 'sw', string>>;

export type SmsCopyKey = keyof typeof COPY;

/** French (West and Central Africa, Rwanda, Morocco) and Portuguese (Mozambique, Angola, Brazil). */
const MORE_COPY: Record<'fr' | 'pt', Record<SmsCopyKey, string>> = {
    fr: {
        ack_sms: 'Merci, votre conseiller va répondre. Pour une réponse de l\'IA tout de suite, envoyez ASK AI et votre question.',
        ack_no_ai: 'Merci, votre conseiller va répondre.',
        ack_chat: 'Merci, votre conseiller répond en général sous {minutes} minutes aux heures de travail. Pour une réponse tout de suite, touchez Ask AI ou envoyez ASK AI.',
        ask_ai_usage: 'Envoyez votre question après ASK AI. Exemple : ASK AI feuilles de maïs qui jaunissent après la pluie.',
        already_answered: 'L\'IA a déjà répondu à votre dernière question. Votre conseiller va suivre.',
        sms_limit_reached: 'Vous avez utilisé les réponses IA par SMS d\'aujourd\'hui. Votre conseiller va répondre.',
        ai_not_on_plan: 'Les réponses IA ne font pas partie de votre offre. Votre conseiller va répondre.',
        more_prompt: 'Répondez MORE pour la suite.',
        more_nothing: 'Il n\'y a rien de plus à envoyer.',
        lang_set: 'Langue : français.',
        lang_usage: 'Envoyez LANG FR pour le français, LANG EN pour l\'anglais, LANG SW pour le kiswahili ou LANG PT pour le portugais.',
        ussd_answer_by_sms: 'Merci. Votre réponse arrive bientôt par SMS.',
        ussd_sent_to_officer: 'Envoyé à votre conseiller. La réponse viendra par SMS.',
        ussd_type_question: 'Écrivez votre question :',
        ussd_type_message: 'Écrivez votre message au conseiller :',
        ussd_invalid: 'Ce choix n\'est pas dans le menu.',
        ussd_register_sms: 'Nous allons vous envoyer un SMS pour créer votre profil. Répondez à ce SMS pour continuer.',
        ussd_not_registered_officer: 'Ce numéro n\'est pas lié à un compte de conseiller.',
        login_code: '{code} est votre code de connexion GPExts. Il expire dans {minutes} minutes. Ne le donnez à personne.',
        diag_crop: 'Quelle culture ?',
        diag_part: 'Quelle partie de la plante ?',
        diag_symptom: 'Que voyez-vous ?',
        diag_confirm_note: 'Ceci est une première réponse. Votre conseiller va la confirmer.',
    },
    pt: {
        ack_sms: 'Obrigado, o seu extensionista vai responder. Para uma resposta da IA agora, envie ASK AI e a sua pergunta.',
        ack_no_ai: 'Obrigado, o seu extensionista vai responder.',
        ack_chat: 'Obrigado, o seu extensionista costuma responder em {minutes} minutos no horário de trabalho. Para uma resposta agora, toque em Ask AI ou envie ASK AI.',
        ask_ai_usage: 'Envie a sua pergunta depois de ASK AI. Exemplo: ASK AI folhas de milho amarelas depois da chuva.',
        already_answered: 'A IA já respondeu à sua última pergunta. O seu extensionista vai acompanhar.',
        sms_limit_reached: 'Já usou as respostas de IA por SMS de hoje. O seu extensionista vai responder.',
        ai_not_on_plan: 'As respostas de IA não fazem parte do seu plano. O seu extensionista vai responder.',
        more_prompt: 'Responda MORE para o resto.',
        more_nothing: 'Não há mais nada para enviar.',
        lang_set: 'Idioma: português.',
        lang_usage: 'Envie LANG PT para português, LANG EN para inglês, LANG SW para kiswahili ou LANG FR para francês.',
        ussd_answer_by_sms: 'Obrigado. A resposta chega em breve por SMS.',
        ussd_sent_to_officer: 'Enviado ao seu extensionista. A resposta virá por SMS.',
        ussd_type_question: 'Escreva a sua pergunta:',
        ussd_type_message: 'Escreva a mensagem para o extensionista:',
        ussd_invalid: 'Essa opção não está no menu.',
        ussd_register_sms: 'Vamos enviar-lhe um SMS para criar o seu perfil. Responda a esse SMS para continuar.',
        ussd_not_registered_officer: 'Este número não está ligado a uma conta de extensionista.',
        login_code: '{code} é o seu código de acesso GPExts. Expira em {minutes} minutos. Não o partilhe com ninguém.',
        diag_crop: 'Que cultura?',
        diag_part: 'Que parte da planta?',
        diag_symptom: 'O que vê?',
        diag_confirm_note: 'Esta é uma primeira resposta. O seu extensionista vai confirmá-la.',
    },
};

export function smsLanguage(preference: string | null | undefined): SmsLanguage {
    const code = preference?.toLowerCase().slice(0, 2);
    return code === 'sw' || code === 'fr' || code === 'pt' ? code : 'en';
}

export function smsCopy(key: SmsCopyKey, language: string | null | undefined): string {
    const lang = smsLanguage(language);
    return lang === 'en' || lang === 'sw' ? COPY[key][lang] : MORE_COPY[lang][key];
}
