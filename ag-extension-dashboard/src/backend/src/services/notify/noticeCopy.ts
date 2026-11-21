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
    harvest_baseline: {
        en: 'How much {crop} did you harvest last season? Reply YIELD and the kg, or the bags (YIELD 10 BAGS). It helps us check whether the advice works.',
        sw: 'Ulivuna {crop} kiasi gani msimu uliopita? Jibu YIELD na kilo, au magunia (YIELD 10 BAGS). Inatusaidia kuona kama ushauri unafanya kazi.',
        fr: 'Combien de {crop} avez-vous récolté la saison dernière ? Répondez YIELD et les kg, ou les sacs (YIELD 10 BAGS). Cela nous aide à vérifier si les conseils marchent.',
        pt: 'Quanto {crop} colheu na época passada? Responda YIELD e os kg, ou os sacos (YIELD 10 BAGS). Ajuda-nos a ver se os conselhos funcionam.',
    },
    harvest_endline: {
        en: 'How much {crop} did you harvest this season? Reply YIELD and the kg, or the bags (YIELD 10 BAGS).',
        sw: 'Ulivuna {crop} kiasi gani msimu huu? Jibu YIELD na kilo, au magunia (YIELD 10 BAGS).',
        fr: 'Combien de {crop} avez-vous récolté cette saison ? Répondez YIELD et les kg, ou les sacs (YIELD 10 BAGS).',
        pt: 'Quanto {crop} colheu nesta época? Responda YIELD e os kg, ou os sacos (YIELD 10 BAGS).',
    },
    harvest_thanks: {
        en: 'Thank you. Recorded: {kg} kg.',
        sw: 'Asante. Imerekodiwa: kilo {kg}.',
        fr: 'Merci. Enregistré : {kg} kg.',
        pt: 'Obrigado. Registado: {kg} kg.',
    },
    harvest_usage: {
        en: 'Send YIELD and the kg you harvested, for example YIELD 900, or the bags, for example YIELD 10 BAGS.',
        sw: 'Tuma YIELD na kilo ulizovuna, mfano YIELD 900, au magunia, mfano YIELD 10 BAGS.',
        fr: 'Envoyez YIELD et les kg récoltés, par exemple YIELD 900, ou les sacs, par exemple YIELD 10 BAGS.',
        pt: 'Envie YIELD e os kg colhidos, por exemplo YIELD 900, ou os sacos, por exemplo YIELD 10 BAGS.',
    },
    advice_followup: {
        en: 'Did you do what your officer advised on {date}? Reply YES, PARTLY or NO.',
        sw: 'Ulifanya alichoshauri afisa wako tarehe {date}? Jibu NDIO, KIASI au HAPANA.',
        fr: 'Avez-vous suivi le conseil de votre conseiller du {date} ? Répondez OUI, EN PARTIE ou NON.',
        pt: 'Fez o que o seu extensionista aconselhou em {date}? Responda SIM, EM PARTE ou NAO.',
    },
    followup_thanks: {
        en: 'Thank you for telling us.',
        sw: 'Asante kwa kutuambia.',
        fr: 'Merci de nous l\'avoir dit.',
        pt: 'Obrigado por nos dizer.',
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
