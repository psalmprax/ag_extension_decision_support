import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { countryOrDefault, findCountry } from '@/shared-api/countries';

/** The country assumed for numbers written without a country code, when nothing else is known. */
export function defaultCountryName(): string {
    return process.env.DEFAULT_COUNTRY || 'Kenya';
}

function isoFor(country?: string | null): CountryCode | undefined {
    const profile = findCountry(country) ?? countryOrDefault(defaultCountryName());
    return (profile.iso2 ?? undefined) as CountryCode | undefined;
}

/**
 * A phone number in E.164 (+254712345678), read in the person's country when it is
 * written locally (0712 345 678). Returns null when it is not a possible number there.
 */
export function toE164(raw: string | null | undefined, country?: string | null): string | null {
    const cleaned = (raw ?? '').replace(/[\s().-]/g, '');
    if (!cleaned) return null;
    const iso = isoFor(country);
    let candidate = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
    // Gateways often drop the plus ("254712…"): a number starting with the country's own
    // calling code and too long to be local is read as international.
    if (!candidate.startsWith('+') && iso) {
        const code = getCountryCallingCode(iso);
        if (candidate.startsWith(code) && !candidate.startsWith('0') && candidate.length > code.length + 8) candidate = `+${candidate}`;
    }
    const parsed = candidate.startsWith('+') ? parsePhoneNumberFromString(candidate) : parsePhoneNumberFromString(candidate, iso);
    return parsed?.isPossible() ? parsed.number : null;
}

/** The ways one number may have been stored, for matching an incoming message to a person. */
export function phoneVariants(raw: string, country?: string | null): string[] {
    const e164 = toE164(raw, country);
    if (!e164) return [raw];
    const parsed = parsePhoneNumberFromString(e164);
    const national = parsed ? parsed.nationalNumber.toString() : '';
    return Array.from(new Set([e164, e164.slice(1), national ? `0${national}` : '', national, raw].filter(Boolean)));
}

/** The country a number belongs to (English name as stored on farmers), or null. */
export function countryOfPhone(raw: string | null | undefined): string | null {
    const e164 = raw?.trim().startsWith('+') ? raw.trim() : toE164(raw);
    const iso = e164 ? parsePhoneNumberFromString(e164)?.country : undefined;
    return iso ? (findCountry(iso)?.name ?? null) : null;
}
