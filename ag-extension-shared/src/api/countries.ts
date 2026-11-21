/**
 * Country profiles: the one place that says how the product behaves in each country —
 * phone numbers, money, time, land units and the languages people farm in. Phone dial
 * codes come from the ISO code (libphonenumber), so they are not repeated here. What the
 * product can actually serve in a country (prices, SMS languages, mobile money) is worked
 * out by the backend from its live integrations; see GET /api/v1/countries.
 */
export type Continent = 'Africa' | 'Europe' | 'Asia' | 'Americas' | 'Oceania' | 'Other';
export type AreaUnit = 'ha' | 'acre';

export interface CountryProfile {
  /** English name; also the value stored on farmers and users. */
  name: string;
  /** ISO 3166-1 alpha-2, or null for "Other". */
  iso2: string | null;
  continent: Continent;
  regions: string[];
  /** ISO 4217 code used for prices and plans. */
  currency: string;
  /** IANA time zones; the first is the default when a person has not chosen one. */
  timeZones: string[];
  /** Languages farmers use, most common first (BCP 47). */
  languages: string[];
  /** How land is usually measured by farmers there; people can change it. */
  areaUnit: AreaUnit;
}

export const COUNTRY_PROFILES: readonly CountryProfile[] = [
  { name: 'Kenya', iso2: 'KE', continent: 'Africa', regions: ["Rift Valley", "Central", "Eastern", "Western", "Nyanza", "Coast", "North Eastern", "Nairobi"], currency: 'KES', timeZones: ["Africa/Nairobi"], languages: ["sw", "en"], areaUnit: 'acre' },
  { name: 'Uganda', iso2: 'UG', continent: 'Africa', regions: ["Central Region", "Eastern Region", "Northern Region", "Western Region", "Karamoja"], currency: 'UGX', timeZones: ["Africa/Kampala"], languages: ["en", "lg", "sw"], areaUnit: 'acre' },
  { name: 'Tanzania', iso2: 'TZ', continent: 'Africa', regions: ["Arusha", "Kilimanjaro", "Mwanza", "Morogoro", "Dodoma", "Dar es Salaam", "Mbeya", "Tanga", "Tabora"], currency: 'TZS', timeZones: ["Africa/Dar_es_Salaam"], languages: ["sw", "en"], areaUnit: 'acre' },
  { name: 'Rwanda', iso2: 'RW', continent: 'Africa', regions: ["Kigali City", "Eastern Province", "Northern Province", "Southern Province", "Western Province"], currency: 'RWF', timeZones: ["Africa/Kigali"], languages: ["rw", "en", "fr", "sw"], areaUnit: 'ha' },
  { name: 'Nigeria', iso2: 'NG', continent: 'Africa', regions: ["North Central", "North East", "North West", "South East", "South South", "South West", "Abuja FCT"], currency: 'NGN', timeZones: ["Africa/Lagos"], languages: ["en", "ha", "yo", "ig"], areaUnit: 'ha' },
  { name: 'Ghana', iso2: 'GH', continent: 'Africa', regions: ["Ashanti", "Eastern", "Greater Accra", "Northern", "Volta", "Western", "Central", "Upper East", "Upper West"], currency: 'GHS', timeZones: ["Africa/Accra"], languages: ["en", "ak", "ee"], areaUnit: 'acre' },
  { name: 'Malawi', iso2: 'MW', continent: 'Africa', regions: ["Central Region (Lilongwe)", "Southern Region (Blantyre)", "Northern Region (Mzuzu)"], currency: 'MWK', timeZones: ["Africa/Blantyre"], languages: ["ny", "en"], areaUnit: 'acre' },
  { name: 'Ethiopia', iso2: 'ET', continent: 'Africa', regions: ["Oromia", "Amhara", "SNNPR", "Sidama", "Somali", "Tigray", "Addis Ababa"], currency: 'ETB', timeZones: ["Africa/Addis_Ababa"], languages: ["am", "om", "ti"], areaUnit: 'ha' },
  { name: 'Zambia', iso2: 'ZM', continent: 'Africa', regions: ["Central", "Copperbelt", "Eastern", "Luapula", "Lusaka", "Muchinga", "Northern", "Southern", "Western"], currency: 'ZMW', timeZones: ["Africa/Lusaka"], languages: ["en", "bem", "ny"], areaUnit: 'ha' },
  { name: 'Zimbabwe', iso2: 'ZW', continent: 'Africa', regions: ["Mashonaland Central", "Mashonaland East", "Mashonaland West", "Manicaland", "Masvingo", "Matabeleland North", "Matabeleland South", "Midlands"], currency: 'USD', timeZones: ["Africa/Harare"], languages: ["en", "sn", "nd"], areaUnit: 'ha' },
  { name: 'South Africa', iso2: 'ZA', continent: 'Africa', regions: ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"], currency: 'ZAR', timeZones: ["Africa/Johannesburg"], languages: ["en", "zu", "xh", "af", "st"], areaUnit: 'ha' },
  { name: 'Egypt', iso2: 'EG', continent: 'Africa', regions: ["Cairo", "Alexandria", "Giza", "Nile Delta", "Upper Egypt", "Suez Canal"], currency: 'EGP', timeZones: ["Africa/Cairo"], languages: ["ar"], areaUnit: 'ha' },
  { name: 'Morocco', iso2: 'MA', continent: 'Africa', regions: ["Casablanca-Settat", "Rabat-Salé-Kénitra", "Fès-Meknès", "Marrakech-Safi", "Souss-Massa", "Tangier-Tetouan"], currency: 'MAD', timeZones: ["Africa/Casablanca"], languages: ["ar", "fr", "zgh"], areaUnit: 'ha' },
  { name: 'United Kingdom', iso2: 'GB', continent: 'Europe', regions: ["England (East)", "England (Midlands)", "England (North)", "England (South)", "Scotland", "Wales", "Northern Ireland"], currency: 'GBP', timeZones: ["Europe/London"], languages: ["en"], areaUnit: 'acre' },
  { name: 'Germany', iso2: 'DE', continent: 'Europe', regions: ["Bavaria", "Baden-Württemberg", "North Rhine-Westphalia", "Lower Saxony", "Hesse", "Saxony", "Brandenburg"], currency: 'EUR', timeZones: ["Europe/Berlin"], languages: ["de"], areaUnit: 'ha' },
  { name: 'France', iso2: 'FR', continent: 'Europe', regions: ["Île-de-France", "Nouvelle-Aquitaine", "Occitanie", "Auvergne-Rhône-Alpes", "Grand Est", "Hauts-de-France", "Brittany", "Normandy"], currency: 'EUR', timeZones: ["Europe/Paris"], languages: ["fr"], areaUnit: 'ha' },
  { name: 'Netherlands', iso2: 'NL', continent: 'Europe', regions: ["North Holland", "South Holland", "Utrecht", "Gelderland", "North Brabant", "Overijssel", "Friesland", "Zeeland"], currency: 'EUR', timeZones: ["Europe/Amsterdam"], languages: ["nl"], areaUnit: 'ha' },
  { name: 'Italy', iso2: 'IT', continent: 'Europe', regions: ["Lombardy", "Veneto", "Emilia-Romagna", "Tuscany", "Piedmont", "Lazio", "Sicily", "Campania", "Apulia"], currency: 'EUR', timeZones: ["Europe/Rome"], languages: ["it"], areaUnit: 'ha' },
  { name: 'Spain', iso2: 'ES', continent: 'Europe', regions: ["Andalusia", "Catalonia", "Community of Madrid", "Valencian Community", "Galicia", "Castile and León", "Aragon"], currency: 'EUR', timeZones: ["Europe/Madrid"], languages: ["es"], areaUnit: 'ha' },
  { name: 'Poland', iso2: 'PL', continent: 'Europe', regions: ["Mazovia", "Greater Poland", "Silesia", "Lower Silesia", "Lesser Poland", "Łódź", "Pomerania"], currency: 'PLN', timeZones: ["Europe/Warsaw"], languages: ["pl"], areaUnit: 'ha' },
  { name: 'Ukraine', iso2: 'UA', continent: 'Europe', regions: ["Kyiv Oblast", "Vinnytsia", "Poltava", "Cherkasy", "Lviv", "Odesa", "Kharkiv", "Dnipro"], currency: 'UAH', timeZones: ["Europe/Kyiv"], languages: ["uk"], areaUnit: 'ha' },
  { name: 'Ireland', iso2: 'IE', continent: 'Europe', regions: ["Leinster", "Munster", "Connacht", "Ulster"], currency: 'EUR', timeZones: ["Europe/Dublin"], languages: ["en", "ga"], areaUnit: 'ha' },
  { name: 'Switzerland', iso2: 'CH', continent: 'Europe', regions: ["Zurich", "Bern", "Vaud", "Geneva", "Ticino", "Aargau", "St. Gallen"], currency: 'CHF', timeZones: ["Europe/Zurich"], languages: ["de", "fr", "it"], areaUnit: 'ha' },
  { name: 'Sweden', iso2: 'SE', continent: 'Europe', regions: ["Stockholm", "Västra Götaland", "Skåne", "Östergötland", "Uppsala"], currency: 'SEK', timeZones: ["Europe/Stockholm"], languages: ["sv"], areaUnit: 'ha' },
  { name: 'Denmark', iso2: 'DK', continent: 'Europe', regions: ["Capital Region", "Central Denmark", "Southern Denmark", "North Denmark", "Zealand"], currency: 'DKK', timeZones: ["Europe/Copenhagen"], languages: ["da"], areaUnit: 'ha' },
  { name: 'Norway', iso2: 'NO', continent: 'Europe', regions: ["Oslo", "Vestland", "Viken", "Trøndelag", "Rogaland", "Nordland"], currency: 'NOK', timeZones: ["Europe/Oslo"], languages: ["nb"], areaUnit: 'ha' },
  { name: 'Austria', iso2: 'AT', continent: 'Europe', regions: ["Vienna", "Lower Austria", "Upper Austria", "Styria", "Tyrol", "Carinthia"], currency: 'EUR', timeZones: ["Europe/Vienna"], languages: ["de"], areaUnit: 'ha' },
  { name: 'Belgium', iso2: 'BE', continent: 'Europe', regions: ["Flanders", "Wallonia", "Brussels-Capital"], currency: 'EUR', timeZones: ["Europe/Brussels"], languages: ["nl", "fr", "de"], areaUnit: 'ha' },
  { name: 'India', iso2: 'IN', continent: 'Asia', regions: ["Punjab", "Haryana", "Uttar Pradesh", "Maharashtra", "Karnataka", "Gujarat", "Tamil Nadu", "Andhra Pradesh", "West Bengal", "Madhya Pradesh"], currency: 'INR', timeZones: ["Asia/Kolkata"], languages: ["hi", "en", "bn", "te", "mr", "ta"], areaUnit: 'acre' },
  { name: 'China', iso2: 'CN', continent: 'Asia', regions: ["Shandong", "Henan", "Sichuan", "Jiangsu", "Guangdong", "Hebei", "Heilongjiang", "Zhejiang", "Hunan"], currency: 'CNY', timeZones: ["Asia/Shanghai"], languages: ["zh"], areaUnit: 'ha' },
  { name: 'Japan', iso2: 'JP', continent: 'Asia', regions: ["Hokkaido", "Tohoku", "Kanto", "Chubu", "Kansai", "Chugoku", "Shikoku", "Kyushu"], currency: 'JPY', timeZones: ["Asia/Tokyo"], languages: ["ja"], areaUnit: 'ha' },
  { name: 'Indonesia', iso2: 'ID', continent: 'Asia', regions: ["West Java", "East Java", "Central Java", "North Sumatra", "South Sulawesi", "Riau", "Lampung", "Bali"], currency: 'IDR', timeZones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"], languages: ["id"], areaUnit: 'ha' },
  { name: 'Vietnam', iso2: 'VN', continent: 'Asia', regions: ["Mekong River Delta", "Red River Delta", "Central Highlands", "Southeast", "North Central Coast"], currency: 'VND', timeZones: ["Asia/Ho_Chi_Minh"], languages: ["vi"], areaUnit: 'ha' },
  { name: 'Philippines', iso2: 'PH', continent: 'Asia', regions: ["Central Luzon", "Calabarzon", "Western Visayas", "Davao Region", "Northern Mindanao", "Ilocos Region", "Cagayan Valley"], currency: 'PHP', timeZones: ["Asia/Manila"], languages: ["fil", "en"], areaUnit: 'ha' },
  { name: 'Thailand', iso2: 'TH', continent: 'Asia', regions: ["Central Thailand", "Northeastern (Isan)", "Northern Thailand", "Southern Thailand", "Eastern Thailand"], currency: 'THB', timeZones: ["Asia/Bangkok"], languages: ["th"], areaUnit: 'ha' },
  { name: 'Pakistan', iso2: 'PK', continent: 'Asia', regions: ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory"], currency: 'PKR', timeZones: ["Asia/Karachi"], languages: ["ur", "en"], areaUnit: 'acre' },
  { name: 'Bangladesh', iso2: 'BD', continent: 'Asia', regions: ["Dhaka", "Chittagong", "Rajshahi", "Khulna", "Rangpur", "Mymensingh", "Sylhet", "Barisal"], currency: 'BDT', timeZones: ["Asia/Dhaka"], languages: ["bn"], areaUnit: 'acre' },
  { name: 'Malaysia', iso2: 'MY', continent: 'Asia', regions: ["Johor", "Selangor", "Perak", "Pahang", "Sabah", "Sarawak", "Kedah", "Kelantan"], currency: 'MYR', timeZones: ["Asia/Kuala_Lumpur"], languages: ["ms", "en"], areaUnit: 'ha' },
  { name: 'South Korea', iso2: 'KR', continent: 'Asia', regions: ["Gyeonggi-do", "Chungcheong-do", "Jeolla-do", "Gyeongsang-do", "Gangwon-do", "Jeju"], currency: 'KRW', timeZones: ["Asia/Seoul"], languages: ["ko"], areaUnit: 'ha' },
  { name: 'Turkey', iso2: 'TR', continent: 'Asia', regions: ["Marmara", "Central Anatolia", "Aegean", "Mediterranean", "Black Sea", "Southeastern Anatolia"], currency: 'TRY', timeZones: ["Europe/Istanbul"], languages: ["tr"], areaUnit: 'ha' },
  { name: 'United States', iso2: 'US', continent: 'Americas', regions: ["California", "Texas", "Iowa", "Illinois", "Florida", "Washington", "Nebraska", "Kansas", "Minnesota", "Georgia"], currency: 'USD', timeZones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"], languages: ["en", "es"], areaUnit: 'acre' },
  { name: 'Canada', iso2: 'CA', continent: 'Americas', regions: ["Ontario", "Quebec", "Saskatchewan", "Alberta", "British Columbia", "Manitoba", "Nova Scotia"], currency: 'CAD', timeZones: ["America/Toronto", "America/Winnipeg", "America/Edmonton", "America/Vancouver", "America/Halifax"], languages: ["en", "fr"], areaUnit: 'acre' },
  { name: 'Mexico', iso2: 'MX', continent: 'Americas', regions: ["Sinaloa", "Jalisco", "Michoacán", "Veracruz", "Guanajuato", "Sonora", "Chihuahua", "Puebla"], currency: 'MXN', timeZones: ["America/Mexico_City", "America/Tijuana", "America/Cancun"], languages: ["es"], areaUnit: 'ha' },
  { name: 'Brazil', iso2: 'BR', continent: 'Americas', regions: ["Mato Grosso", "São Paulo", "Paraná", "Rio Grande do Sul", "Minas Gerais", "Bahia", "Goiás", "Mato Grosso do Sul"], currency: 'BRL', timeZones: ["America/Sao_Paulo", "America/Manaus"], languages: ["pt"], areaUnit: 'ha' },
  { name: 'Argentina', iso2: 'AR', continent: 'Americas', regions: ["Buenos Aires", "Córdoba", "Santa Fe", "Entre Ríos", "Mendoza", "Tucumán", "Salta"], currency: 'ARS', timeZones: ["America/Argentina/Buenos_Aires"], languages: ["es"], areaUnit: 'ha' },
  { name: 'Colombia', iso2: 'CO', continent: 'Americas', regions: ["Antioquia", "Cundinamarca", "Valle del Cauca", "Santander", "Huila", "Tolima", "Nariño", "Boyacá"], currency: 'COP', timeZones: ["America/Bogota"], languages: ["es"], areaUnit: 'ha' },
  { name: 'Chile', iso2: 'CL', continent: 'Americas', regions: ["Maule", "Higgins\", ", ", ", ", ", ", ", ", "], currency: 'CLP', timeZones: ["America/Santiago"], languages: ["es"], areaUnit: 'ha' },
  { name: 'Peru', iso2: 'PE', continent: 'Americas', regions: ["La Libertad", "Piura", "Ica", "Lima", "Arequipa", "Lambayeque", "San Martín", "Junín"], currency: 'PEN', timeZones: ["America/Lima"], languages: ["es", "qu"], areaUnit: 'ha' },
  { name: 'Australia', iso2: 'AU', continent: 'Oceania', regions: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Northern Territory"], currency: 'AUD', timeZones: ["Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth"], languages: ["en"], areaUnit: 'ha' },
  { name: 'New Zealand', iso2: 'NZ', continent: 'Oceania', regions: ["Canterbury", "Waikato", "Auckland", "Bay of Plenty", "Manawatū-Whanganui", "Otago", "Hawke’s Bay", "Southland", "Taranaki"], currency: 'NZD', timeZones: ["Pacific/Auckland"], languages: ["en", "mi"], areaUnit: 'ha' },
  { name: 'Papua New Guinea', iso2: 'PG', continent: 'Oceania', regions: ["Highlands", "Momase", "Southern Region", "Islands Region"], currency: 'PGK', timeZones: ["Pacific/Port_Moresby"], languages: ["tpi", "en"], areaUnit: 'ha' },
  { name: 'Fiji', iso2: 'FJ', continent: 'Oceania', regions: ["Western Division", "Central Division", "Northern Division", "Eastern Division"], currency: 'FJD', timeZones: ["Pacific/Fiji"], languages: ["en", "fj"], areaUnit: 'ha' },
  { name: 'Other', iso2: null, continent: 'Other', regions: [], currency: 'USD', timeZones: ['UTC'], languages: ['en'], areaUnit: 'ha' },
];

export const CONTINENT_ORDER: readonly Continent[] = ['Africa', 'Europe', 'Asia', 'Americas', 'Oceania', 'Other'];

/** The default when nothing is known about where someone is. */
export const DEFAULT_COUNTRY = 'Kenya';

const BY_KEY = new Map<string, CountryProfile>();
for (const profile of COUNTRY_PROFILES) {
  BY_KEY.set(profile.name.toLowerCase(), profile);
  if (profile.iso2) BY_KEY.set(profile.iso2.toLowerCase(), profile);
}
BY_KEY.set('usa', BY_KEY.get('us')!);
BY_KEY.set('uk', BY_KEY.get('gb')!);

/** A country by English name or ISO code (any case), or null. */
export function findCountry(nameOrIso?: string | null): CountryProfile | null {
  if (!nameOrIso) return null;
  return BY_KEY.get(nameOrIso.trim().toLowerCase()) ?? null;
}

/** A country, falling back to the default country. */
export function countryOrDefault(nameOrIso?: string | null): CountryProfile {
  return findCountry(nameOrIso) ?? findCountry(DEFAULT_COUNTRY)!;
}

/** Whether a string is a time zone this runtime knows. */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export const HECTARES_PER_ACRE = 0.40468564224;

/** Land area in the given unit, from hectares (as stored). */
export function areaFromHectares(hectares: number, unit: AreaUnit): number {
  return unit === 'acre' ? hectares / HECTARES_PER_ACRE : hectares;
}

/** Hectares (as stored), from an area in the given unit. */
export function areaToHectares(value: number, unit: AreaUnit): number {
  return unit === 'acre' ? value * HECTARES_PER_ACRE : value;
}
