/** USSD menu wording in English and Kiswahili (see smsCopy for the language rule). */
import { smsLanguage } from './smsCopy';

const MENUS = {
    farmer: {
        en: ['Ask a question', 'Crop problem', 'Weather', 'Market prices', 'Message my officer', 'Language'],
        sw: ['Uliza swali', 'Tatizo la zao', 'Hali ya hewa', 'Bei za soko', 'Ujumbe kwa afisa', 'Lugha'],
    },
    visitor: {
        en: ['Register by SMS', 'Ask a question', 'Weather', 'Market prices'],
        sw: ['Jisajili kwa SMS', 'Uliza swali', 'Hali ya hewa', 'Bei za soko'],
    },
    staff: {
        en: ['Set or change SMS PIN', 'Ask a question'],
        sw: ['Weka au badilisha PIN ya SMS', 'Uliza swali'],
    },
    crops: {
        en: ['Maize', 'Beans', 'Tomato', 'Potato', 'Cassava', 'Coffee', 'Other'],
        sw: ['Mahindi', 'Maharagwe', 'Nyanya', 'Viazi', 'Muhogo', 'Kahawa', 'Nyingine'],
    },
    parts: {
        en: ['Leaves', 'Stem', 'Roots', 'Fruit or cob', 'Whole plant'],
        sw: ['Majani', 'Shina', 'Mizizi', 'Tunda au gunzi', 'Mmea mzima'],
    },
    symptoms: {
        en: ['Yellowing', 'Spots or patches', 'Holes or eaten', 'Wilting', 'Rot or mould', 'Insects seen'],
        sw: ['Manjano', 'Madoa', 'Mashimo au kuliwa', 'Kunyauka', 'Kuoza au ukungu', 'Wadudu wameonekana'],
    },
    languages: { en: ['English', 'Kiswahili'], sw: ['English', 'Kiswahili'] },
} as const;

export type UssdList = keyof typeof MENUS;

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
