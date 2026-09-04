export interface CountryConfig {
  name: string;
  flag: string;
  continent: 'Africa' | 'Europe' | 'Asia' | 'Americas' | 'Oceania' | 'Other';
  regions: string[];
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  // ── Africa ──
  {
    name: 'Kenya',
    flag: '🇰🇪',
    continent: 'Africa',
    regions: ['Rift Valley', 'Central', 'Eastern', 'Western', 'Nyanza', 'Coast', 'North Eastern', 'Nairobi'],
  },
  {
    name: 'Uganda',
    flag: '🇺🇬',
    continent: 'Africa',
    regions: ['Central Region', 'Eastern Region', 'Northern Region', 'Western Region', 'Karamoja'],
  },
  {
    name: 'Tanzania',
    flag: '🇹🇿',
    continent: 'Africa',
    regions: ['Arusha', 'Kilimanjaro', 'Mwanza', 'Morogoro', 'Dodoma', 'Dar es Salaam', 'Mbeya', 'Tanga', 'Tabora'],
  },
  {
    name: 'Rwanda',
    flag: '🇷🇼',
    continent: 'Africa',
    regions: ['Kigali City', 'Eastern Province', 'Northern Province', 'Southern Province', 'Western Province'],
  },
  {
    name: 'Nigeria',
    flag: '🇳🇬',
    continent: 'Africa',
    regions: ['North Central', 'North East', 'North West', 'South East', 'South South', 'South West', 'Abuja FCT'],
  },
  {
    name: 'Ghana',
    flag: '🇬🇭',
    continent: 'Africa',
    regions: ['Ashanti', 'Eastern', 'Greater Accra', 'Northern', 'Volta', 'Western', 'Central', 'Upper East', 'Upper West'],
  },
  {
    name: 'Malawi',
    flag: '🇲🇼',
    continent: 'Africa',
    regions: ['Central Region (Lilongwe)', 'Southern Region (Blantyre)', 'Northern Region (Mzuzu)'],
  },
  {
    name: 'Ethiopia',
    flag: '🇪🇹',
    continent: 'Africa',
    regions: ['Oromia', 'Amhara', 'SNNPR', 'Sidama', 'Somali', 'Tigray', 'Addis Ababa'],
  },
  {
    name: 'Zambia',
    flag: '🇿🇲',
    continent: 'Africa',
    regions: ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'Southern', 'Western'],
  },
  {
    name: 'Zimbabwe',
    flag: '🇿🇼',
    continent: 'Africa',
    regions: ['Mashonaland Central', 'Mashonaland East', 'Mashonaland West', 'Manicaland', 'Masvingo', 'Matabeleland North', 'Matabeleland South', 'Midlands'],
  },
  {
    name: 'South Africa',
    flag: '🇿🇦',
    continent: 'Africa',
    regions: ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'],
  },
  {
    name: 'Egypt',
    flag: '🇪🇬',
    continent: 'Africa',
    regions: ['Cairo', 'Alexandria', 'Giza', 'Nile Delta', 'Upper Egypt', 'Suez Canal'],
  },
  {
    name: 'Morocco',
    flag: '🇲🇦',
    continent: 'Africa',
    regions: ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Fès-Meknès', 'Marrakech-Safi', 'Souss-Massa', 'Tangier-Tetouan'],
  },

  // ── Europe ──
  {
    name: 'United Kingdom',
    flag: '🇬🇧',
    continent: 'Europe',
    regions: ['England (East)', 'England (Midlands)', 'England (North)', 'England (South)', 'Scotland', 'Wales', 'Northern Ireland'],
  },
  {
    name: 'Germany',
    flag: '🇩🇪',
    continent: 'Europe',
    regions: ['Bavaria', 'Baden-Württemberg', 'North Rhine-Westphalia', 'Lower Saxony', 'Hesse', 'Saxony', 'Brandenburg'],
  },
  {
    name: 'France',
    flag: '🇫🇷',
    continent: 'Europe',
    regions: ['Île-de-France', 'Nouvelle-Aquitaine', 'Occitanie', 'Auvergne-Rhône-Alpes', 'Grand Est', 'Hauts-de-France', 'Brittany', 'Normandy'],
  },
  {
    name: 'Netherlands',
    flag: '🇳🇱',
    continent: 'Europe',
    regions: ['North Holland', 'South Holland', 'Utrecht', 'Gelderland', 'North Brabant', 'Overijssel', 'Friesland', 'Zeeland'],
  },
  {
    name: 'Italy',
    flag: '🇮🇹',
    continent: 'Europe',
    regions: ['Lombardy', 'Veneto', 'Emilia-Romagna', 'Tuscany', 'Piedmont', 'Lazio', 'Sicily', 'Campania', 'Apulia'],
  },
  {
    name: 'Spain',
    flag: '🇪🇸',
    continent: 'Europe',
    regions: ['Andalusia', 'Catalonia', 'Community of Madrid', 'Valencian Community', 'Galicia', 'Castile and León', 'Aragon'],
  },
  {
    name: 'Poland',
    flag: '🇵🇱',
    continent: 'Europe',
    regions: ['Mazovia', 'Greater Poland', 'Silesia', 'Lower Silesia', 'Lesser Poland', 'Łódź', 'Pomerania'],
  },
  {
    name: 'Ukraine',
    flag: '🇺🇦',
    continent: 'Europe',
    regions: ['Kyiv Oblast', 'Vinnytsia', 'Poltava', 'Cherkasy', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'],
  },
  {
    name: 'Ireland',
    flag: '🇮🇪',
    continent: 'Europe',
    regions: ['Leinster', 'Munster', 'Connacht', 'Ulster'],
  },
  {
    name: 'Switzerland',
    flag: '🇨🇭',
    continent: 'Europe',
    regions: ['Zurich', 'Bern', 'Vaud', 'Geneva', 'Ticino', 'Aargau', 'St. Gallen'],
  },
  {
    name: 'Sweden',
    flag: '🇸🇪',
    continent: 'Europe',
    regions: ['Stockholm', 'Västra Götaland', 'Skåne', 'Östergötland', 'Uppsala'],
  },
  {
    name: 'Denmark',
    flag: '🇩🇰',
    continent: 'Europe',
    regions: ['Capital Region', 'Central Denmark', 'Southern Denmark', 'North Denmark', 'Zealand'],
  },
  {
    name: 'Norway',
    flag: '🇳🇴',
    continent: 'Europe',
    regions: ['Oslo', 'Vestland', 'Viken', 'Trøndelag', 'Rogaland', 'Nordland'],
  },
  {
    name: 'Austria',
    flag: '🇦🇹',
    continent: 'Europe',
    regions: ['Vienna', 'Lower Austria', 'Upper Austria', 'Styria', 'Tyrol', 'Carinthia'],
  },
  {
    name: 'Belgium',
    flag: '🇧🇪',
    continent: 'Europe',
    regions: ['Flanders', 'Wallonia', 'Brussels-Capital'],
  },

  // ── Asia ──
  {
    name: 'India',
    flag: '🇮🇳',
    continent: 'Asia',
    regions: ['Punjab', 'Haryana', 'Uttar Pradesh', 'Maharashtra', 'Karnataka', 'Gujarat', 'Tamil Nadu', 'Andhra Pradesh', 'West Bengal', 'Madhya Pradesh'],
  },
  {
    name: 'China',
    flag: '🇨🇳',
    continent: 'Asia',
    regions: ['Shandong', 'Henan', 'Sichuan', 'Jiangsu', 'Guangdong', 'Hebei', 'Heilongjiang', 'Zhejiang', 'Hunan'],
  },
  {
    name: 'Japan',
    flag: '🇯🇵',
    continent: 'Asia',
    regions: ['Hokkaido', 'Tohoku', 'Kanto', 'Chubu', 'Kansai', 'Chugoku', 'Shikoku', 'Kyushu'],
  },
  {
    name: 'Indonesia',
    flag: '🇮🇩',
    continent: 'Asia',
    regions: ['West Java', 'East Java', 'Central Java', 'North Sumatra', 'South Sulawesi', 'Riau', 'Lampung', 'Bali'],
  },
  {
    name: 'Vietnam',
    flag: '🇻🇳',
    continent: 'Asia',
    regions: ['Mekong River Delta', 'Red River Delta', 'Central Highlands', 'Southeast', 'North Central Coast'],
  },
  {
    name: 'Philippines',
    flag: '🇵🇭',
    continent: 'Asia',
    regions: ['Central Luzon', 'Calabarzon', 'Western Visayas', 'Davao Region', 'Northern Mindanao', 'Ilocos Region', 'Cagayan Valley'],
  },
  {
    name: 'Thailand',
    flag: '🇹🇭',
    continent: 'Asia',
    regions: ['Central Thailand', 'Northeastern (Isan)', 'Northern Thailand', 'Southern Thailand', 'Eastern Thailand'],
  },
  {
    name: 'Pakistan',
    flag: '🇵🇰',
    continent: 'Asia',
    regions: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory'],
  },
  {
    name: 'Bangladesh',
    flag: '🇧🇩',
    continent: 'Asia',
    regions: ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Rangpur', 'Mymensingh', 'Sylhet', 'Barisal'],
  },
  {
    name: 'Malaysia',
    flag: '🇲🇾',
    continent: 'Asia',
    regions: ['Johor', 'Selangor', 'Perak', 'Pahang', 'Sabah', 'Sarawak', 'Kedah', 'Kelantan'],
  },
  {
    name: 'South Korea',
    flag: '🇰🇷',
    continent: 'Asia',
    regions: ['Gyeonggi-do', 'Chungcheong-do', 'Jeolla-do', 'Gyeongsang-do', 'Gangwon-do', 'Jeju'],
  },
  {
    name: 'Turkey',
    flag: '🇹🇷',
    continent: 'Asia',
    regions: ['Marmara', 'Central Anatolia', 'Aegean', 'Mediterranean', 'Black Sea', 'Southeastern Anatolia'],
  },

  // ── Americas ──
  {
    name: 'United States',
    flag: '🇺🇸',
    continent: 'Americas',
    regions: ['California', 'Texas', 'Iowa', 'Illinois', 'Florida', 'Washington', 'Nebraska', 'Kansas', 'Minnesota', 'Georgia'],
  },
  {
    name: 'Canada',
    flag: '🇨🇦',
    continent: 'Americas',
    regions: ['Ontario', 'Quebec', 'Saskatchewan', 'Alberta', 'British Columbia', 'Manitoba', 'Nova Scotia'],
  },
  {
    name: 'Mexico',
    flag: '🇲🇽',
    continent: 'Americas',
    regions: ['Sinaloa', 'Jalisco', 'Michoacán', 'Veracruz', 'Guanajuato', 'Sonora', 'Chihuahua', 'Puebla'],
  },
  {
    name: 'Brazil',
    flag: '🇧🇷',
    continent: 'Americas',
    regions: ['Mato Grosso', 'São Paulo', 'Paraná', 'Rio Grande do Sul', 'Minas Gerais', 'Bahia', 'Goiás', 'Mato Grosso do Sul'],
  },
  {
    name: 'Argentina',
    flag: '🇦🇷',
    continent: 'Americas',
    regions: ['Buenos Aires', 'Córdoba', 'Santa Fe', 'Entre Ríos', 'Mendoza', 'Tucumán', 'Salta'],
  },
  {
    name: 'Colombia',
    flag: '🇨🇴',
    continent: 'Americas',
    regions: ['Antioquia', 'Cundinamarca', 'Valle del Cauca', 'Santander', 'Huila', 'Tolima', 'Nariño', 'Boyacá'],
  },
  {
    name: 'Chile',
    flag: '🇨🇱',
    continent: 'Americas',
    regions: ['Maule', "O'Higgins", 'Metropolitan Region of Santiago', 'Biobío', 'Valparaíso', 'Araucanía', 'Coquimbo'],
  },
  {
    name: 'Peru',
    flag: '🇵🇪',
    continent: 'Americas',
    regions: ['La Libertad', 'Piura', 'Ica', 'Lima', 'Arequipa', 'Lambayeque', 'San Martín', 'Junín'],
  },

  // ── Oceania ──
  {
    name: 'Australia',
    flag: '🇦🇺',
    continent: 'Oceania',
    regions: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Northern Territory'],
  },
  {
    name: 'New Zealand',
    flag: '🇳🇿',
    continent: 'Oceania',
    regions: ['Canterbury', 'Waikato', 'Auckland', 'Bay of Plenty', 'Manawatū-Whanganui', 'Otago', 'Hawke’s Bay', 'Southland', 'Taranaki'],
  },
  {
    name: 'Papua New Guinea',
    flag: '🇵🇬',
    continent: 'Oceania',
    regions: ['Highlands', 'Momase', 'Southern Region', 'Islands Region'],
  },
  {
    name: 'Fiji',
    flag: '🇫🇯',
    continent: 'Oceania',
    regions: ['Western Division', 'Central Division', 'Northern Division', 'Eastern Division'],
  },

  // ── Other ──
  {
    name: 'Other',
    flag: '🌐',
    continent: 'Other',
    regions: [],
  },
];

export const CONTINENT_ORDER = ['Africa', 'Europe', 'Asia', 'Americas', 'Oceania', 'Other'] as const;

export function getCountryFlag(countryName?: string): string {
  if (!countryName) return '🇰🇪';
  return SUPPORTED_COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase())?.flag || '🌐';
}

export function getCountryConfig(countryName?: string): CountryConfig | null {
  if (!countryName) return null;
  return SUPPORTED_COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase()) || null;
}
