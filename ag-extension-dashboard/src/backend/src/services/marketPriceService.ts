import { logger } from '@/utils/logger';
import axios from 'axios';
import { rateLimitedFetch } from './externalApiGuard';
import { recordPriceSnapshot } from './priceHistoryService';
import { cacheGet, cacheSet } from './cacheService';
import { countryOfUser } from './country/countryContext';
import { findCountry } from '@/shared-api/countries';

export type MarketDataStatus = 'live' | 'estimated' | 'unavailable';

/**
 * Where the price sits in the value chain. Never mix them in one series: a
 * producer price and a retail median are different quantities, not revisions.
 */
export type PriceType = 'producer' | 'wholesale' | 'retail';

export interface MarketPrice {
  id: string;
  crop: string;
  price: string;
  priceValue?: number;
  trend: string;
  updatedAt: Date;
  source: 'faostat_producer_prices' | 'giews_fpma' | 'usda_fas_psd' | 'baseline_estimate' | 'fewsnet' | 'wfp';
  dataStatus: MarketDataStatus;
  fetchedAt: string;
  exchangeRateSource: 'live' | 'fallback' | 'native';
  currency: string;
  /** Year the FAOSTAT producer price refers to — a yearly series, not a spot quote. */
  period?: string | null;
  /** Native USD producer price per tonne, before any currency conversion. */
  usdPerTonne?: number | null;
  /** Change against the previous published year. */
  yoyPct?: number | null;
  /** Value-chain stage the figure belongs to. */
  priceType?: PriceType | null;
}

interface ExchangeRateResult {
  rate: number;
  source: 'live' | 'fallback';
  asOf: string;
  estimated: boolean;
  /** True when even the fallback is past its freshness TTL — display only, never settle. */
  stale: boolean;
}

/**
 * Settlement-grade gate: only live, non-estimated, non-stale FX may back settlement,
 * BCR publication, or arbitrage execution. Estimated rates are display-only.
 */
export function isSettlementGradeRate(result: ExchangeRateResult): boolean {
  return result.source === 'live' && !result.estimated && !result.stale;
}

// Last-known-good live rates: served (flagged estimated) while fresh so a
// transient feed outage degrades to minutes-old reality, not static tables.
const lastLiveRates = new Map<string, { rate: number; asOf: string }>();

function fxFreshnessTtlMs(): number {
  const parsed = Number(process.env.FX_LIVE_TTL_MS ?? 24 * 60 * 60 * 1000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24 * 60 * 60 * 1000;
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
  const code = codes[lower.trim()];
  if (!code) throw new Error(`No country-specific FAOSTAT price mapping is configured for ${country}`);
  return code;
}

/** The caller's country, or null when none is recorded: prices are never another country's. */
export async function getUserCountry(userId?: string): Promise<string | null> {
  return countryOfUser(userId);
}

/** FAOSTAT area code for the caller's country, or null when there is none to use. */
export async function resolveUserAreaCode(userId?: string): Promise<string | null> {
  const country = await getUserCountry(userId);
  if (!country || !isPriceCountrySupported(country)) return null;
  return faostatAreaCode(country);
}

export function isPriceCountrySupported(country: string): boolean {
  try {
    faostatAreaCode(country);
    return true;
  } catch {
    return false;
  }
}

function getCurrencyForCountry(country: string): string {
  return findCountry(country)?.currency ?? 'USD';
}

const usdIdentityRate = (): ExchangeRateResult =>
  ({ rate: 1, source: 'live', asOf: new Date().toISOString(), estimated: false, stale: false });

async function fetchExchangeRate(targetCurrency: string): Promise<ExchangeRateResult> {
  if (targetCurrency === 'USD') return usdIdentityRate();
  const cacheKey = `rate:${targetCurrency}`;
  try {
    return await rateLimitedFetch<ExchangeRateResult>('openERate', cacheKey, async () => {
      const response = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 });
      const rate = response.data?.rates?.[targetCurrency];
      if (typeof rate === 'number' && Number.isFinite(rate)) {
        logger.info(`Live USD/${targetCurrency} exchange rate: ${rate}`);
        lastLiveRates.set(targetCurrency, { rate, asOf: new Date().toISOString() });
        return { rate, source: 'live' as const, asOf: new Date().toISOString(), estimated: false, stale: false };
      }
      throw new Error('Invalid rate in response');
    });
  } catch (err: unknown) {
    logger.warn(`Failed to fetch live USD/${targetCurrency} exchange rate: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  return fallbackExchangeRate(targetCurrency);
}

/** Rate without a network call: the last live rate while fresh, else the static table (stale). */
function fallbackExchangeRate(targetCurrency: string): ExchangeRateResult {
  if (targetCurrency === 'USD') return usdIdentityRate();
  const lastGood = lastLiveRates.get(targetCurrency);
  if (lastGood && Date.now() - new Date(lastGood.asOf).getTime() <= fxFreshnessTtlMs()) {
    logger.warn(`Serving last-known-good USD/${targetCurrency} from ${lastGood.asOf} (estimated)`);
    return { rate: lastGood.rate, source: 'fallback', asOf: lastGood.asOf, estimated: true, stale: false };
  }
  // Static fallback is ESTIMATED and STALE by construction — display only.
  // Callers (BCR, arbitrage) must surface exchangeRateSource=fallback + asOf to the user.
  const fallbackRates: Record<string, number> = {
    NGN: 1500, GHS: 14.5, TZS: 2600, UGX: 3750, ETB: 57,
    INR: 83.5, BRL: 5.5, KES: 129.5,
  };
  const asOf = new Date().toISOString();
  logger.warn(`Using STALE ESTIMATED fallback FX for USD/${targetCurrency} as of ${asOf} — do not use for settlement`);
  return { rate: fallbackRates[targetCurrency] || 129.5, source: 'fallback', asOf, estimated: true, stale: true };
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

// FAOSTAT producer prices are published yearly, so live rows are kept for 6 h;
// estimates and baselines for 30 min, so a recovered upstream is picked up soon.
// Without this every page load waited on up to four upstream calls (20-40 s
// when FAOSTAT is slow), which left the price cards spinning.
const PRICE_CACHE_TTL_LIVE_S = 6 * 60 * 60;
const PRICE_CACHE_TTL_ESTIMATE_S = 30 * 60;
const inFlightPrices = new Map<string, Promise<MarketPrice[]>>();

const priceCacheKey = (country: string) => `market-prices:v1:${country}`;

// A cold lookup tries four upstream sources in turn (up to ~27 s). Callers wait
// at most this long, then get the labelled baseline estimate while the live
// fetch carries on and fills the cache for the next request.
function priceLookupBudgetMs(): number {
  const parsed = Number(process.env.MARKET_PRICE_BUDGET_MS ?? 5000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

/**
 * The baseline describes East African markets (90 kg bags, finger millet), so it is only
 * offered there; anywhere else an empty list says plainly that there are no prices yet.
 */
const BASELINE_COUNTRIES = new Set(['KE', 'UG', 'TZ', 'RW']);

function estimatedPricesFor(country: string): MarketPrice[] {
  const iso = findCountry(country)?.iso2;
  if (!iso || !BASELINE_COUNTRIES.has(iso)) return [];
  const currency = getCurrencyForCountry(country);
  return buildBaselinePrices(fallbackExchangeRate(currency), currency, new Date().toISOString());
}

/**
 * Waits at most the lookup budget for `fetching`. `null` means the budget ran
 * out: the caller serves its labelled fallback while the fetch keeps running
 * and fills the cache for the next request.
 */
async function withinBudget<T>(country: string, fetching: Promise<T>): Promise<T | null> {
  const budgetMs = priceLookupBudgetMs();
  let timer: NodeJS.Timeout | undefined;
  const budget = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), budgetMs); });
  try {
    const result = await Promise.race([fetching, budget]);
    if (result !== null) return result;
  } finally {
    clearTimeout(timer);
  }
  logger.warn(`Market prices for ${country} not ready after ${budgetMs} ms; serving the labelled fallback meanwhile`);
  fetching.catch(error => logger.warn(
    `Background market price fetch for ${country} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
  ));
  return null;
}

async function readCachedPrices(country: string): Promise<MarketPrice[] | null> {
  const raw = await cacheGet(priceCacheKey(country));
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as MarketPrice[]).map(row => ({ ...row, updatedAt: new Date(row.updatedAt) }));
  } catch (error) {
    logger.warn(`Ignoring unreadable cached prices for ${country}: ${error instanceof Error ? error.message : 'parse error'}`);
    return null;
  }
}

/** The three crops the public landing card shows, in display order. */
const LANDING_CROPS = ['0112', '01591', '0115'] as const;

/** Annual series lag a year or two; probe back this far before giving up. */
const FAOSTAT_YEAR_PROBES = 4;

const landingCacheKey = (country: string) => `market-prices:landing:v1:${country}`;
const inFlightLanding = new Map<string, Promise<LandingMarketPrices>>();

export interface LandingPrice {
  crop: string;
  cropCode: string;
  usdPerTonne: number;
  usdPerKg: number;
  /** Derived at 90 kg per bag — the unit the card quotes. */
  usdPerBag90kg: number;
  yoyPct: number | null;
  priceType: 'producer';
}

export interface LandingMarketPrices {
  prices: LandingPrice[];
  /** Published year of the figures — never present them as a current quote. */
  period: string | null;
  dataStatus: 'live' | 'unavailable';
  fetchedAt: string;
}

/** Newest published year wins; returns [] when none of the probed years has data. */
async function fetchLatestFaostatYear(areaCode: string, itemCodes: string[]): Promise<FaostatPriceRow[]> {
  const currentYear = new Date().getFullYear();
  for (let offset = 0; offset < FAOSTAT_YEAR_PROBES; offset++) {
    const rows = await fetchFaostatProducerPrices(areaCode, itemCodes, String(currentYear - offset));
    if (rows.length > 0) return rows;
  }
  return [];
}

/** FAOSTAT already reports USD/tonne (element 5532), so no FX conversion is applied. */
function toLandingPrices(rows: FaostatPriceRow[], previousYearRows: FaostatPriceRow[]): LandingPrice[] {
  const previous = new Map<string, number>();
  for (const row of previousYearRows) {
    const value = Number(row.value);
    if (value > 0) previous.set(row.item_code, value);
  }

  const order = new Map<string, number>(LANDING_CROPS.map((code, index) => [code, index]));
  const seen = new Set<string>();
  const prices: LandingPrice[] = [];

  for (const row of rows) {
    if (seen.has(row.item_code)) continue;
    const usdPerTonne = Number(row.value);
    if (!Number.isFinite(usdPerTonne) || usdPerTonne <= 0) continue;
    seen.add(row.item_code);
    const previousValue = previous.get(row.item_code);

    prices.push({
      crop: FAOSTAT_CROP_CODE[row.item_code] || row.item_code,
      cropCode: row.item_code,
      usdPerTonne: Math.round(usdPerTonne * 100) / 100,
      usdPerKg: Math.round((usdPerTonne / 1000) * 10000) / 10000,
      usdPerBag90kg: Math.round(usdPerTonne * 0.09 * 100) / 100,
      yoyPct: previousValue
        ? Math.round(((usdPerTonne - previousValue) / previousValue) * 1000) / 10
        : null,
      priceType: 'producer',
    });
  }

  return prices.sort((a, b) => (order.get(a.cropCode) ?? 99) - (order.get(b.cropCode) ?? 99));
}

export const marketPriceService = {
  /**
   * Latest prices for the user's country: cached, one upstream fetch at a time
   * per country, and never more than the lookup budget of waiting.
   */
  async getLatestPrices(userId?: string, countryOverride?: string): Promise<MarketPrice[]> {
    const country = countryOverride || await getUserCountry(userId);
    if (!country) return [];
    const cached = await readCachedPrices(country);
    if (cached) return cached;
    const fetched = await withinBudget(country, inFlightPrices.get(country) ?? this.startPriceFetch(country));
    return fetched ?? estimatedPricesFor(country);
  },

  /** Fetches upstream once and caches the result (live 6 h, estimates 30 min). */
  startPriceFetch(country: string): Promise<MarketPrice[]> {
    const fetching = this.fetchLatestPrices(country)
      .then(async result => {
        const live = result.length > 0 && result.every(row => row.dataStatus === 'live');
        await cacheSet(priceCacheKey(country), JSON.stringify(result), live ? PRICE_CACHE_TTL_LIVE_S : PRICE_CACHE_TTL_ESTIMATE_S);
        return result;
      })
      .finally(() => inFlightPrices.delete(country));
    inFlightPrices.set(country, fetching);
    return fetching;
  },

  /**
   * Public landing-card prices: the three priority crops, in native USD, with
   * the published year attached. Never invents a number when upstream is empty.
   */
  async getLandingPrices(country: string): Promise<LandingMarketPrices> {
    const cached = await cacheGet(landingCacheKey(country));
    if (cached) {
      try {
        return JSON.parse(cached) as LandingMarketPrices;
      } catch (error) {
        logger.warn(
          `Ignoring unreadable cached landing prices for ${country}: ${error instanceof Error ? error.message : 'parse error'}`
        );
      }
    }

    // A cold lookup probes four years plus the year before the hit — up to five
    // 8 s upstream calls, longer than the app's 30 s request budget. Answer
    // within the lookup budget instead of letting the public card time out.
    const snapshot = await withinBudget(
      country,
      inFlightLanding.get(country) ?? this.startLandingFetch(country)
    );
    // The timeout fallback is deliberately not cached: only a real upstream
    // answer may suppress the next lookup.
    return snapshot ?? {
      prices: [],
      period: null,
      dataStatus: 'unavailable',
      fetchedAt: new Date().toISOString(),
    };
  },

  /** Runs the landing fetch once per country and caches what upstream returned. */
  startLandingFetch(country: string): Promise<LandingMarketPrices> {
    const fetching = this.fetchLandingSnapshot(country).finally(() => inFlightLanding.delete(country));
    inFlightLanding.set(country, fetching);
    return fetching;
  },

  async fetchLandingSnapshot(country: string): Promise<LandingMarketPrices> {
    const areaCode = faostatAreaCode(country);
    const rows = await fetchLatestFaostatYear(areaCode, [...LANDING_CROPS]);
    const period = rows[0]?.year ?? null;
    const previousYearRows = period
      ? await fetchFaostatProducerPrices(areaCode, [...LANDING_CROPS], String(Number(period) - 1))
      : [];
    const prices = toLandingPrices(rows, previousYearRows);

    const snapshot: LandingMarketPrices = {
      prices,
      period,
      dataStatus: prices.length > 0 ? 'live' : 'unavailable',
      fetchedAt: new Date().toISOString(),
    };

    await cacheSet(
      landingCacheKey(country),
      JSON.stringify(snapshot),
      prices.length > 0 ? PRICE_CACHE_TTL_LIVE_S : PRICE_CACHE_TTL_ESTIMATE_S
    );
    return snapshot;
  },

  async fetchLatestPrices(country: string): Promise<MarketPrice[]> {
    const areaCode = faostatAreaCode(country);
    const targetCurrency = getCurrencyForCountry(country);
    const exchangeRate = await fetchExchangeRate(targetCurrency);
    const fetchedAt = new Date().toISOString();
    // Producer prices are annual and published with a lag, so the current year
    // is usually empty. Probe back until a published year answers.
    const prices = await fetchLatestFaostatYear(areaCode, PRIORITY_CROPS);
    const previousYearPrices = prices.length > 0
      ? await fetchFaostatProducerPrices(areaCode, PRIORITY_CROPS, String(Number(prices[0].year) - 1))
      : [];

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
  fetchedAt: string, index: number, year: string | null,
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
    period: year,
    usdPerTonne: value,
    yoyPct: trendPct !== null ? Number(trendPct) : null,
    priceType: 'producer',
    source: 'faostat_producer_prices' as const,
    // A FAOSTAT price converted with estimated FX is not a live quote.
    dataStatus: (exchangeRate.estimated ? 'estimated' : 'live') as MarketDataStatus,
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

  // Every row of a yearly series carries the same published year.
  const year = prices[0]?.year ?? null;
  let index = 0;
  const result: MarketPrice[] = [];
  for (const [code, { value }] of cropMap.entries()) {
    if (index >= 6) break;
    result.push(buildFaostatPriceRow(code, value, 'USD/tonne', prevMap, exchangeRate, areaCode, targetCurrency, fetchedAt, index, year));
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
      dataStatus: (exchangeRate.estimated ? 'estimated' : 'live') as MarketDataStatus,
      fetchedAt,
      exchangeRateSource: exchangeRate.source,
      currency: targetCurrency,
      priceType: 'wholesale' as const,
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