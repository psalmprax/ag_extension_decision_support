/**
 * Countries as the product knows them. The profiles themselves (regions, currency, time
 * zones, languages, land unit) live in the shared contract so the backend reads the same
 * table; what can be served in each country comes from GET /countries (see useCountryCoverage).
 */
import { COUNTRY_PROFILES, CONTINENT_ORDER, findCountry, type CountryProfile } from '@ag-extension/shared/api';

export { CONTINENT_ORDER, findCountry };
export type { CountryProfile };

export const SUPPORTED_COUNTRIES: readonly CountryProfile[] = COUNTRY_PROFILES;

export function getCountryConfig(countryName?: string): CountryProfile | null {
  return findCountry(countryName);
}

/** The country this browser is set to (en-NG → Nigeria), or null when it does not say. */
export function browserCountry(): string | null {
  if (typeof navigator === 'undefined') return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag?.split('-')[1];
    const found = region ? findCountry(region) : null;
    if (found) return found.name;
  }
  return null;
}
