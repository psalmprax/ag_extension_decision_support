/**
 * Short notices sent to farmers by SMS, WhatsApp or Telegram. Same rule as smsCopy:
 * Kiswahili, French and Portuguese wording should be checked by a native speaker before
 * a launch in a new area. Every notice that is not a reply says how to stop notices.
 */
import { smsLanguage } from '@/services/sms/smsCopy';

const NOTICES = {
    registered: {
        en: 'You are registered with {officer}, your extension officer. Text this number to ask a question. Reply STOP to stop notices.',
        sw: 'Umesajiliwa na {officer}, afisa wako wa ugani. Tuma ujumbe kwa nambari hii kuuliza swali. Jibu STOP kusitisha taarifa.',
        fr: 'Vous êtes inscrit auprès de {officer}, votre conseiller agricole. Écrivez à ce numéro pour poser une question. Répondez STOP pour ne plus recevoir d\'avis.',
        pt: 'Está registado com {officer}, o seu extensionista. Escreva para este número para fazer uma pergunta. Responda STOP para deixar de receber avisos.',
    },
    visit_planned: {
        en: '{officer} plans to visit your farm on {date}. Reply here if that day does not suit you. Reply STOP to stop notices.',
        sw: '{officer} anapanga kutembelea shamba lako tarehe {date}. Jibu hapa kama siku hiyo haikufai. Jibu STOP kusitisha taarifa.',
        fr: '{officer} prévoit de visiter votre exploitation le {date}. Répondez ici si ce jour ne vous convient pas. Répondez STOP pour ne plus recevoir d\'avis.',
        pt: '{officer} planeia visitar a sua machamba em {date}. Responda aqui se esse dia não lhe convier. Responda STOP para deixar de receber avisos.',
    },
    visit_moved: {
        en: '{officer} moved the visit to your farm to {date}. Reply here if that day does not suit you.',
        sw: '{officer} amehamisha ziara ya shamba lako hadi tarehe {date}. Jibu hapa kama siku hiyo haikufai.',
        fr: '{officer} a déplacé la visite de votre exploitation au {date}. Répondez ici si ce jour ne vous convient pas.',
        pt: '{officer} mudou a visita à sua machamba para {date}. Responda aqui se esse dia não lhe convier.',
    },
    visit_cancelled: {
        en: '{officer} cancelled the visit to your farm planned for {date}. Reply here to ask for a new day.',
        sw: '{officer} amefuta ziara ya shamba lako iliyopangwa tarehe {date}. Jibu hapa kuomba siku nyingine.',
        fr: '{officer} a annulé la visite de votre exploitation prévue le {date}. Répondez ici pour demander un autre jour.',
        pt: '{officer} cancelou a visita à sua machamba marcada para {date}. Responda aqui para pedir outro dia.',
    },
    stopped: {
        en: 'You will get no more notices. Your officer can still answer your messages. Send START to get notices again.',
        sw: 'Hutapokea taarifa tena. Afisa wako bado anaweza kujibu ujumbe wako. Tuma START kupokea taarifa tena.',
        fr: 'Vous ne recevrez plus d\'avis. Votre conseiller peut toujours répondre à vos messages. Envoyez START pour les recevoir à nouveau.',
        pt: 'Não vai receber mais avisos. O seu extensionista ainda pode responder às suas mensagens. Envie START para voltar a receber avisos.',
    },
    started: {
        en: 'Notices are on again. Send STOP to stop them.',
        sw: 'Taarifa zimewashwa tena. Tuma STOP kuzisitisha.',
        fr: 'Les avis sont de nouveau activés. Envoyez STOP pour les arrêter.',
        pt: 'Os avisos voltaram a estar ligados. Envie STOP para os parar.',
    },
} as const satisfies Record<string, Record<'en' | 'sw' | 'fr' | 'pt', string>>;

export type NoticeKey = keyof typeof NOTICES;

/** The notice in the farmer's language with {placeholders} filled in. */
export function noticeText(key: NoticeKey, language: string | null | undefined, vars: Record<string, string> = {}): string {
    const template: string = NOTICES[key][smsLanguage(language)];
    return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

/** STOP and START in the words farmers use. */
export const STOP_WORDS = new Set(['STOP', 'ACHA', 'SITISHA', 'ARRET', 'ARRÊT', 'PARAR', 'UNSUBSCRIBE']);
export const START_WORDS = new Set(['START', 'ANZA', 'REPRENDRE', 'INICIAR', 'SUBSCRIBE']);
