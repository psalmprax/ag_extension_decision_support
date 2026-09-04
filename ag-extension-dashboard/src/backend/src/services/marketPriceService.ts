import { getPrisma } from './prismaService';
import { logger } from '@/utils/logger';
import axios from 'axios';
import { rateLimitedFetch } from './externalApiGuard';
import { recordPriceSnapshot } from './priceHistoryService';

export type MarketDataStatus = 'live' | 'estimated' | 'unavailable';

export interface MarketPrice {
  id: string;
  crop: string;
  price: string;
  priceValue?: number;
  trend: string;
  updatedAt: Date;
  source: 'faostat_producer_prices' | 'giews_fpma' | 'usda_fas_psd' | 'baseline_estimate';
  dataStatus: MarketDataStatus;
  fetchedAt: string;
  exchangeRateSource: 'live' | 'fallback';
  currency: string;
}

interface ExchangeRateResult {
  rate: number;
  source: 'live' | 'fallback';
}

// ─── FAOSTAT commodity code → display name mapping ──────────────────
const FAOSTAT_CROP_CODE: Record<string, string> = {
  '0111': 'Wheat',
  '0112': 'Maize (Corn)',
  '0113': 'Rice (Paddy)',
  '0114': 'Barley',
  '0115': 'Sorghum',
  '0116': 'Millet',
  '0117': 'Oats',
  '01591': 'Beans (Dry)',
  '01592': 'Cowpeas',
  '01593': 'Pigeon Peas',
  '0156': 'Cassava',
  '0157': 'Potatoes',
  '0158': 'Sweet Potatoes',
  '0146': 'Soybeans',
  '0148': 'Groundnuts',
  '0149': 'Sunflower Seed',
  '0161': 'Sugar Cane',
  '0181': 'Coffee (Green)',
  '0182': 'Tea',
  '0183': 'Cocoa Beans',
};

// ─── AFRO Asian priority crops ──────────────────────────────────────
const PRIORITY_CROPS = ['0112', '0115', '0116', '01591', '01592', '0146', '0161', '0181', '0182'];

// ─── Country → FAOSTAT area code ────────────────────────────────────
function faostatAreaCode(country: string): string {
  const lower = country.toLowerCase();
  const codes: Record<string, string> = {
    'kenya': '114', 'nigeria': '159', 'ghana': '81', 'tanzania': '215',
    'uganda': '226', 'ethiopia': '62', 'rwanda': '184', 'malawi': '130',
    'zambia': '251', 'zimbabwe': '181', 'mozambique': '144', 'south africa': '202',
    'india': '100', 'brazil': '21', 'united states': '231', 'usa': '231',
    'canada': '33',
  };
  for (const [key, code] of Object.entries(codes)) {
    if (lower.includes(key)) return code;
  }
  return lower.includes('kenya') ? '114' : '158'; // default to Nigeria
}

async function getUserCountry(userId?: string): Promise<string> {
  if (!userId) return 'Kenya';
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'farmer') {
      const farmer = await prisma.farmer.findFirst({ where: { userId: user.id } });
      if (farmer?.country) return farmer.country;
    } else if (user?.region) {
      return user.region;
    }
  } catch (err) {
    logger.error(`Error looking up user country details for ${userId}:`, err);
  }
  return 'Kenya';
}

export async function resolveUserAreaCode(userId?: string): Promise<string> {
  const country = await getUserCountry(userId);
  return faostatAreaCode(country);
}

function getCurrencyForCountry(country: string): string {
  const countryLower = country.toLowerCase();
  const mappings = [
    { keys: ['nigeria', 'ng'], currency: 'NGN' },
    { keys: ['ghana', 'gh'], currency: 'GHS' },
    { keys: ['tanzania', 'tz'], currency: 'TZS' },
    { keys: ['uganda', 'ug'], currency: 'UGX' },
    { keys: ['ethiopia', 'et'], currency: 'ETB' },
    { keys: ['india', 'in'], currency: 'INR' },
    { keys: ['brazil', 'br'], currency: 'BRL' },
    { keys: ['usa', 'united states', 'us'], currency: 'USD' },
  ];
  const match = mappings.find(mapping => mapping.keys.some(key => countryLower.includes(key)));
  return match?.currency || 'KES';
}

async function fetchExchangeRate(targetCurrency: string): Promise<ExchangeRateResult> {
  if (targetCurrency === 'USD') return { rate: 1, source: 'live' };
  const cacheKey = `rate:${targetCurrency}`;
  try {
    return await rateLimitedFetch<ExchangeRateResult>('openERate', cacheKey, async () => {
      const response = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 });
      const rate = response.data?.rates?.[targetCurrency];
      if (typeof rate === 'number' && Number.isFinite(rate)) {
        logger.info(`Live USD/${targetCurrency} exchange rate: ${rate}`);
        return { rate, source: 'live' as const };
      }
      throw new Error('Invalid rate in response');
    });
  } catch (err: unknown) {
    logger.warn(`Failed to fetch live USD/${targetCurrency} exchange rate: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  const fallbackRates: Record<string, number> = {
    NGN: 1500, GHS: 14.5, TZS: 2600, UGX: 3750, ETB: 57,
    INR: 83.5, BRL: 5.5, KES: 129.5,
  };
  return { rate: fallbackRates[targetCurrency] || 129.5, source: 'fallback' };
}

function roundPrice(rawPrice: number, targetCurrency: string): number {
  if (['KES', 'TZS', 'UGX', 'NGN'].includes(targetCurrency)) return Math.round(rawPrice / 50) * 50;
  if (['USD', 'GHS', 'BRL'].includes(targetCurrency)) return Math.round(rawPrice * 100) / 100;
  return Math.round(rawPrice);
}

// ─── Real FAOSTAT Producer Prices ──────────────────────────────────
interface FaostatPriceRow {
  area: string;
  item: string;
  item_code: string;
  element: string;
  year: string;
  unit: string;
  value: string;
  flag: string;
}

async function fetchFaostatProducerPrices(
  areaCode: string,
  itemCodes: string[],
  year: string
): Promise<FaostatPriceRow[]> {
  const cacheKey = `pp:${areaCode}:${itemCodes.slice(0, 3).join(',')}:${year}`;
  try {
    return await rateLimitedFetch<FaostatPriceRow[]>('faostat', cacheKey, async () => {
      const baseUrl = 'https://fenixservices.fao.org/faostat/api/v1/en/data/PP';
      const response = await axios.get<{ data: FaostatPriceRow[] }>(baseUrl, {
        params: {
          area: areaCode,
          item: itemCodes.join(','),
          element: '5532',
          year,
          format: 'json',
        },
        timeout: 8000,
      });
      if (response.data?.data && Array.isArray(response.data.data)) {
        logger.info(`FAOSTAT: fetched ${response.data.data.length} producer price rows for area ${areaCode}`);
        return response.data.data;
      }
      return [];
    });
  } catch (err) {
    logger.warn(`FAOSTAT Producer Prices unavailable for area ${areaCode}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return [];
  }
}

// ─── GIEWS FPMA fallback for African retail prices ─────────────────
interface GiewsPricePoint {
  commodity: string;
  market: string;
  price: number;
  currency: string;
  usd_per_tonne: number;
  date: string;
}

async function fetchGiewsPrices(country: string, cropFilter: string[]): Promise<GiewsPricePoint[]> {
  const areaCd = faostatAreaCode(country);
  const cacheKey = `fp:${areaCd}:${cropFilter.slice(0, 3).join(',')}`;
  try {
    return await rateLimitedFetch<GiewsPricePoint[]>('giews', cacheKey, async () => {
      const response = await axios.get('https://fenixservices.fao.org/faostat/api/v1/en/data/FP', {
        params: { area: areaCd, item: cropFilter.join(','), format: 'json' },
        timeout: 8000,
      });
      const rows = response.data?.data;
      if (!Array.isArray(rows)) return [];
      return rows
        .filter((r: Record<string, unknown>) => r.value && Number(r.value) > 0)
        .map((r: Record<string, unknown>) => ({
          commodity: String(r.item || ''),
          market: String(r.area || ''),
          price: Number(r.value),
          currency: 'USD',
          usd_per_tonne: Number(r.value),
          date: String(r.year || ''),
        }));
    });
  } catch (err) {
    logger.warn(`GIEWS FPMA unavailable for ${country}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return [];
  }
}

// ─── GIEWS → baseline fallback chain ──────────────────────────────
async function resolveGiewsOrBaseline(
  country: string,
  exchangeRate: ExchangeRateResult,
  targetCurrency: string,
  fetchedAt: string,
): Promise<MarketPrice[]> {
  try {
    const giewsData = await fetchGiewsPrices(country, PRIORITY_CROPS);
    if (giewsData.length > 0) {
      return mapGiewsPrices(giewsData, exchangeRate, targetCurrency, fetchedAt);
    }
  } catch (err) {
    logger.warn(`GIEWS fallback failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  logger.warn(`No live market data available for ${country}. Using baseline estimates.`);
  return buildBaselinePrices(exchangeRate, targetCurrency, fetchedAt);
}

export const marketPriceService = {
  async getLatestPrices(userId?: string): Promise<MarketPrice[]> {
    const country = await getUserCountry(userId);
    const targetCurrency = getCurrencyForCountry(country);
    const exchangeRate = await fetchExchangeRate(targetCurrency);
    const fetchedAt = new Date().toISOString();
    const areaCode = faostatAreaCode(country);
    const currentYear = String(new Date().getFullYear());
    const previousYear = String(Number(currentYear) - 1);

    // Try FAOSTAT Producer Prices first
    const faoPrices = await fetchFaostatProducerPrices(areaCode, PRIORITY_CROPS, currentYear);
    const previousYearPrices = faoPrices.length === 0
      ? await fetchFaostatProducerPrices(areaCode, PRIORITY_CROPS, previousYear)
      : [];

    const prices = faoPrices.length > 0 ? faoPrices : previousYearPrices;
    const result = prices.length > 0
      ? mapFaostatPrices(prices, previousYearPrices, exchangeRate, targetCurrency, areaCode, fetchedAt)
      : await resolveGiewsOrBaseline(country, exchangeRate, targetCurrency, fetchedAt);

    // Record a daily history snapshot (only live data — estimates are excluded).
    recordPriceSnapshot(areaCode, result).catch(err => {
      logger.warn(`Price history record failed for area ${areaCode}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    });

    return result;
  },
};

// ─── FAOSTAT → MarketPrice mapping helper ──────────────────────────
// ─── Build a single MarketPrice row from FAOSTAT data ──────────────
function buildFaostatPriceRow(
  code: string, value: number, unit: string, prevMap: Map<string, number>,
  exchangeRate: ExchangeRateResult, areaCode: string, targetCurrency: string,
  fetchedAt: string, index: number,
): MarketPrice {
  const displayName = FAOSTAT_CROP_CODE[code] || code;
  const localPrice = roundPrice(value * exchangeRate.rate / 1000, targetCurrency);
  const prevValue = prevMap.get(code);
  const trendPct = prevValue != null ? ((value - prevValue) / prevValue * 100).toFixed(1) : null;
  const trend = trendPct !== null ? (Number(trendPct) >= 0 ? `+${trendPct}%` : `${trendPct}%`) : 'New';

  return {
    id: `faostat-${areaCode}-${code}-${index}`,
    crop: displayName,
    price: `${targetCurrency} ${localPrice.toLocaleString()}`,
    priceValue: localPrice,
    trend,
    updatedAt: new Date(fetchedAt),
    source: 'faostat_producer_prices' as const,
    dataStatus: 'live' as const,
    fetchedAt,
    exchangeRateSource: exchangeRate.source,
    currency: targetCurrency,
  };
}

function mapFaostatPrices(
  prices: FaostatPriceRow[],
  previousYearPrices: FaostatPriceRow[],
  exchangeRate: ExchangeRateResult,
  targetCurrency: string,
  areaCode: string,
  fetchedAt: string,
): MarketPrice[] {
  const cropMap = new Map<string, { value: number; unit: string }>();
  for (const row of prices) {
    const val = Number(row.value);
    if (val > 0 && !cropMap.has(row.item_code)) {
      cropMap.set(row.item_code, { value: val, unit: row.unit || 'USD/tonne' });
    }
  }

  const prevMap = new Map<string, number>();
  for (const row of previousYearPrices) {
    const val = Number(row.value);
    if (val > 0) prevMap.set(row.item_code, val);
  }

  let index = 0;
  const result: MarketPrice[] = [];
  for (const [code, { value }] of cropMap.entries()) {
    if (index >= 6) break;
    result.push(buildFaostatPriceRow(code, value, 'USD/tonne', prevMap, exchangeRate, areaCode, targetCurrency, fetchedAt, index));
    index++;
  }
  return result;
}

// ─── GIEWS → MarketPrice mapping helper ─────────────────────────────
function mapGiewsPrices(
  giewsData: GiewsPricePoint[],
  exchangeRate: ExchangeRateResult,
  targetCurrency: string,
  fetchedAt: string,
): MarketPrice[] {
  return giewsData.slice(0, 6).map((pt, i) => {
    const localPrice = roundPrice(pt.usd_per_tonne * exchangeRate.rate / 1000, targetCurrency);
    return {
      id: `giews-${i}`,
      crop: pt.commodity,
      price: `${targetCurrency} ${localPrice.toLocaleString()}`,
      priceValue: localPrice,
      trend: 'Updated',
      updatedAt: new Date(fetchedAt),
      source: 'giews_fpma' as const,
      dataStatus: 'live' as const,
      fetchedAt,
      exchangeRateSource: exchangeRate.source,
      currency: targetCurrency,
    };
  });
}

// ─── Baseline fallback prices (honest about being estimated) ────────
function buildBaselinePrices(
  exchangeRate: ExchangeRateResult,
  targetCurrency: string,
  fetchedAt: string,
): MarketPrice[] {
  const basePrices = [
    { crop: 'White Maize (90kg)', baseUSD: 32.4 },
    { crop: 'Dry Beans (90kg)', baseUSD: 96.5 },
    { crop: 'Sorghum (90kg)', baseUSD: 29.3 },
    { crop: 'Finger Millet (90kg)', baseUSD: 71 },
  ];
  return basePrices.map((item, index) => {
    const finalPrice = roundPrice(item.baseUSD * exchangeRate.rate, targetCurrency);
    return {
      id: `baseline-${targetCurrency.toLowerCase()}-${index + 1}`,
      crop: item.crop,
      price: `${targetCurrency} ${finalPrice.toLocaleString()}`,
      priceValue: finalPrice,
      trend: 'Stable' as const,
      updatedAt: new Date(fetchedAt),
      source: 'baseline_estimate' as const,
      dataStatus: 'estimated' as const,
      fetchedAt,
      exchangeRateSource: exchangeRate.source,
      currency: targetCurrency,
    };
  });
}