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
    weather_warning: {
        en: 'Weather warning for your farm on {date}: {condition} (Open-Meteo forecast). Reply STOP to stop notices.',
        sw: 'Tahadhari ya hali ya hewa kwa shamba lako tarehe {date}: {condition} (utabiri wa Open-Meteo). Jibu STOP kusitisha taarifa.',
        fr: 'Alerte météo pour votre exploitation le {date} : {condition} (prévision Open-Meteo). Répondez STOP pour ne plus recevoir d\'avis.',
        pt: 'Alerta meteorológico para a sua machamba em {date}: {condition} (previsão Open-Meteo). Responda STOP para deixar de receber avisos.',
    },
    weather_warning_rain: {
        en: 'Weather warning for your farm on {date}: {condition}, about {mm} mm of rain (Open-Meteo forecast). Reply STOP to stop notices.',
        sw: 'Tahadhari ya hali ya hewa kwa shamba lako tarehe {date}: {condition}, takriban mm {mm} za mvua (utabiri wa Open-Meteo). Jibu STOP kusitisha taarifa.',
        fr: 'Alerte météo pour votre exploitation le {date} : {condition}, environ {mm} mm de pluie (prévision Open-Meteo). Répondez STOP pour ne plus recevoir d\'avis.',
        pt: 'Alerta meteorológico para a sua machamba em {date}: {condition}, cerca de {mm} mm de chuva (previsão Open-Meteo). Responda STOP para deixar de receber avisos.',
    },
    harvest_rain: {
        en: 'Rain forecast for your farm on {date}: {condition} (Open-Meteo forecast). Your {crop} harvest is due around {harvest}. Reply STOP to stop notices.',
        sw: 'Mvua inatarajiwa shambani kwako tarehe {date}: {condition} (utabiri wa Open-Meteo). Mavuno yako ya {crop} yanatarajiwa karibu tarehe {harvest}. Jibu STOP kusitisha taarifa.',
        fr: 'Pluie prévue sur votre exploitation le {date} : {condition} (prévision Open-Meteo). Votre récolte de {crop} est prévue vers le {harvest}. Répondez STOP pour ne plus recevoir d\'avis.',
        pt: 'Chuva prevista para a sua machamba em {date}: {condition} (previsão Open-Meteo). A sua colheita de {crop} está prevista para cerca de {harvest}. Responda STOP para deixar de receber avisos.',
    },
    officer_alert: {
        en: 'Alert from {officer}: {title}. Reply here to ask about it. Reply STOP to stop notices.',
        sw: 'Tahadhari kutoka kwa {officer}: {title}. Jibu hapa kuuliza zaidi. Jibu STOP kusitisha taarifa.',
        fr: 'Alerte de {officer} : {title}. Répondez ici pour en savoir plus. Répondez STOP pour ne plus recevoir d\'avis.',
        pt: 'Alerta de {officer}: {title}. Responda aqui para saber mais. Responda STOP para deixar de receber avisos.',
    },
} as const satisfies Record<string, Record<'en' | 'sw' | 'fr' | 'pt', string>>;

/** The forecast's rain and severe conditions (Open-Meteo weather codes 63, 65, 75, 81, 82, 95, 96) as farmers read them. */
const WEATHER_WORDS: Record<string, Record<'en' | 'sw' | 'fr' | 'pt', string>> = {
    'Moderate rain': { en: 'moderate rain', sw: 'mvua ya wastani', fr: 'pluie modérée', pt: 'chuva moderada' },
    'Moderate rain showers': { en: 'moderate rain showers', sw: 'manyunyu ya wastani', fr: 'averses modérées', pt: 'aguaceiros moderados' },
    'Heavy rain': { en: 'heavy rain', sw: 'mvua kubwa', fr: 'fortes pluies', pt: 'chuva forte' },
    'Violent rain showers': { en: 'violent rain showers', sw: 'mvua kubwa za ghafla', fr: 'averses violentes', pt: 'aguaceiros violentos' },
    Thunderstorm: { en: 'thunderstorm', sw: 'radi na dhoruba', fr: 'orages', pt: 'trovoada' },
    'Thunderstorm with hail': { en: 'thunderstorm with hail', sw: 'dhoruba ya radi na mvua ya mawe', fr: 'orages avec grêle', pt: 'trovoada com granizo' },
    'Heavy snow': { en: 'heavy snow', sw: 'theluji nzito', fr: 'fortes chutes de neige', pt: 'neve forte' },
};

/** A forecast condition in the farmer's language; the forecast's own words when there is no translation. */
export function weatherConditionText(condition: string, language: string | null | undefined): string {
    return WEATHER_WORDS[condition]?.[smsLanguage(language)] ?? condition.toLowerCase();
}

export type NoticeKey = keyof typeof NOTICES;

/** The notice in the farmer's language with {placeholders} filled in. */
export function noticeText(key: NoticeKey, language: string | null | undefined, vars: Record<string, string> = {}): string {
    const template: string = NOTICES[key][smsLanguage(language)];
    return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

/** STOP and START in the words farmers use. */
export const STOP_WORDS = new Set(['STOP', 'ACHA', 'SITISHA', 'ARRET', 'ARRÊT', 'PARAR', 'UNSUBSCRIBE']);
export const START_WORDS = new Set(['START', 'ANZA', 'REPRENDRE', 'INICIAR', 'SUBSCRIBE']);
