/** USSD menu wording in English, Kiswahili, French and Portuguese (see smsCopy for the language rule). */
import { smsLanguage } from './smsCopy';

const MENUS = {
    farmer: {
        en: ['Ask a question', 'Crop problem', 'Weather', 'Market prices', 'Message my officer', 'Language'],
        sw: ['Uliza swali', 'Tatizo la zao', 'Hali ya hewa', 'Bei za soko', 'Ujumbe kwa afisa', 'Lugha'],
        fr: ['Poser une question', 'Problème de culture', 'Météo', 'Prix du marché', 'Message au conseiller', 'Langue'],
        pt: ['Fazer uma pergunta', 'Problema na cultura', 'Tempo', 'Preços do mercado', 'Mensagem ao extensionista', 'Idioma'],
    },
    visitor: {
        en: ['Register by SMS', 'Ask a question', 'Weather', 'Market prices'],
        sw: ['Jisajili kwa SMS', 'Uliza swali', 'Hali ya hewa', 'Bei za soko'],
        fr: ['S’inscrire par SMS', 'Poser une question', 'Météo', 'Prix du marché'],
        pt: ['Registar por SMS', 'Fazer uma pergunta', 'Tempo', 'Preços do mercado'],
    },
    staff: {
        en: ['Set or change SMS PIN', 'Ask a question'],
        sw: ['Weka au badilisha PIN ya SMS', 'Uliza swali'],
        fr: ['Créer ou changer le PIN SMS', 'Poser une question'],
        pt: ['Criar ou mudar o PIN SMS', 'Fazer uma pergunta'],
    },
    crops: {
        en: ['Maize', 'Beans', 'Tomato', 'Potato', 'Cassava', 'Coffee', 'Other'],
        sw: ['Mahindi', 'Maharagwe', 'Nyanya', 'Viazi', 'Muhogo', 'Kahawa', 'Nyingine'],
        fr: ['Maïs', 'Haricot', 'Tomate', 'Pomme de terre', 'Manioc', 'Café', 'Autre'],
        pt: ['Milho', 'Feijão', 'Tomate', 'Batata', 'Mandioca', 'Café', 'Outra'],
    },
    parts: {
        en: ['Leaves', 'Stem', 'Roots', 'Fruit or cob', 'Whole plant'],
        sw: ['Majani', 'Shina', 'Mizizi', 'Tunda au gunzi', 'Mmea mzima'],
        fr: ['Feuilles', 'Tige', 'Racines', 'Fruit ou épi', 'Plante entière'],
        pt: ['Folhas', 'Caule', 'Raízes', 'Fruto ou maçaroca', 'Planta inteira'],
    },
    symptoms: {
        en: ['Yellowing', 'Spots or patches', 'Holes or eaten', 'Wilting', 'Rot or mould', 'Insects seen'],
        sw: ['Manjano', 'Madoa', 'Mashimo au kuliwa', 'Kunyauka', 'Kuoza au ukungu', 'Wadudu wameonekana'],
        fr: ['Jaunissement', 'Taches', 'Trous ou mangé', 'Flétrissement', 'Pourriture ou moisissure', 'Insectes vus'],
        pt: ['Amarelecimento', 'Manchas', 'Buracos ou comido', 'Murcha', 'Podridão ou bolor', 'Insetos vistos'],
    },
    // The same list in every language: each language in its own name.
    languages: {
        en: ['English', 'Kiswahili', 'Français', 'Português'],
        sw: ['English', 'Kiswahili', 'Français', 'Português'],
        fr: ['English', 'Kiswahili', 'Français', 'Português'],
        pt: ['English', 'Kiswahili', 'Français', 'Português'],
    },
} as const;

export type UssdList = keyof typeof MENUS;

/** Language codes in the order of the language menu. */
export const USSD_LANGUAGE_CODES = ['en', 'sw', 'fr', 'pt'] as const;

export function ussdOptions(list: UssdList, language: string | null | undefined): readonly string[] {
    return MENUS[list][smsLanguage(language)];
}

/** "1. Maize\n2. Beans ..." */
export function numbered(list: UssdList, language: string | null | undefined): string {
    return ussdOptions(list, language).map((label, i) => `${i + 1}. ${label}`).join('\n');
}

/** The option a typed number picks, or null when it is not on the list. */
export function pick(list: UssdList, language: string | null | undefined, choice: string | undefined): string | null {
    const index = Number.parseInt(choice ?? '', 10) - 1;
    const options = ussdOptions(list, language);
    return Number.isInteger(index) && index >= 0 && index < options.length ? options[index] : null;
}

export const con = (text: string) => `CON ${text}`;
export const end = (text: string) => `END ${text}`;
