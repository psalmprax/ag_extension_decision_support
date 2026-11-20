import { COUNTRY_PROFILES, type CountryProfile } from '@/shared-api/countries';
import { FEWS_COUNTRIES } from '@/services/fewsnetService';
import { WFP_COUNTRIES } from '@/services/wfpService';
import { isPriceCountrySupported } from '@/services/marketPriceService';
import { SMS_LANGUAGES } from '@/services/sms/smsCopy';

export type PriceCoverage = 'local_markets' | 'national_yearly' | 'none';
export type SupportLevel = 'full' | 'partial' | 'basic';

export interface CountryCoverage extends CountryProfile {
    prices: PriceCoverage;
    /** Languages the SMS and USSD service answers in, for this country. */
    smsLanguages: string[];
    mobileMoney: string[];
    supportLevel: SupportLevel;
}

/**
 * What the product can actually serve in each country, worked out from its live
 * integrations rather than claimed: market price sources, SMS languages and mobile money.
 * Weather, soil, satellite greenness and the AI agronomist work everywhere.
 */
export function countryCoverage(profile: CountryProfile): CountryCoverage {
    const iso = profile.iso2 ?? '';
    const prices: PriceCoverage = FEWS_COUNTRIES.includes(iso) || WFP_COUNTRIES.includes(iso)
        ? 'local_markets'
        : isPriceCountrySupported(profile.name) ? 'national_yearly' : 'none';
    const smsLanguages = SMS_LANGUAGES.filter(language => language === 'en' || profile.languages.includes(language));
    const mobileMoney = iso === 'KE' && process.env.MPESA_CONSUMER_KEY && process.env.MPESA_ENV === 'production' ? ['mpesa'] : [];
    const speaksLocalLanguage = smsLanguages.some(language => profile.languages.includes(language));
    const supportLevel: SupportLevel = prices === 'local_markets' && speaksLocalLanguage
        ? 'full'
        : prices !== 'none' ? 'partial' : 'basic';
    return { ...profile, prices, smsLanguages, mobileMoney, supportLevel };
}

export function allCountryCoverage(): CountryCoverage[] {
    return COUNTRY_PROFILES.map(countryCoverage);
}
