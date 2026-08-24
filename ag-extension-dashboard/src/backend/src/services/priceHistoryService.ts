import { cacheHSet, cacheHGetAll, cacheHDel, cacheExpire } from './cacheService';
import { logger } from '@/utils/logger';
import type { MarketPrice, MarketDataStatus } from './marketPriceService';

/**
 * Daily price history snapshots, aggregated in Redis.
 *
 * Each day the resolved local-currency price per crop is written into a Redis
 * hash keyed `ext:price_history:{areaCode}` with a `{date}:{crop}` field. The
 * hash is pruned to a 31-day window and given a matching TTL.
 *
 * Honesty note: FAOSTAT producer prices are annual and GIEWS FPMA is monthly,
 * so day-to-day movement in this series is driven by the daily FX conversion —
 * not by a live intra-day ticker. Estimated baseline snapshots (the synthetic
 * fallback) are intentionally NOT recorded, so the history only ever contains
 * real API-sourced data.
 */

const HISTORY_KEY_PREFIX = 'ext:price_history:';
const WINDOW_DAYS = 31;

export interface PriceSnapshot {
  date: string;      // YYYY-MM-DD
  crop: string;
  price: number;     // numeric local-currency price
  currency: string;
  source: string;
  dataStatus: MarketDataStatus;
}

export interface PriceHistorySeries {
  crop: string;
  currency: string;
  source: string;
  dataStatus: MarketDataStatus;
  series: Array<{ date: string; price: number }>;
}

function historyKey(areaCode: string): string {
  return `${HISTORY_KEY_PREFIX}${areaCode}`;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function cutoffDate(days: number): string {
  return isoDate(new Date(Date.now() - days * 86400000));
}

/**
 * Record today's live prices for a country. Non-blocking failures are logged
 * and swallowed so price serving never breaks on a history-write error.
 */
export async function recordPriceSnapshot(areaCode: string, prices: MarketPrice[]): Promise<void> {
  const livePrices = prices.filter(p => p.dataStatus === 'live' && p.priceValue != null);
  if (livePrices.length === 0) return;

  const key = historyKey(areaCode);
  const today = isoDate(new Date());

  try {
    for (const p of livePrices) {
      const snapshot: PriceSnapshot = {
        date: today,
        crop: p.crop,
        price: p.priceValue as number,
        currency: p.currency,
        source: p.source,
        dataStatus: p.dataStatus,
      };
      await cacheHSet(key, `${today}:${p.crop}`, JSON.stringify(snapshot));
    }
    await pruneHistory(key);
  } catch (err) {
    logger.warn(`Failed to record price history for area ${areaCode}: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function pruneHistory(key: string): Promise<void> {
  const cutoff = cutoffDate(WINDOW_DAYS);
  const all = await cacheHGetAll(key);
  if (!all) return;

  const staleFields = Object.keys(all).filter(field => field.split(':')[0] < cutoff);
  if (staleFields.length > 0) {
    await cacheHDel(key, ...staleFields);
  }
  await cacheExpire(key, WINDOW_DAYS * 86400);
}

/**
 * Retrieve the last `days` days of price snapshots for a country, grouped by
 * crop and sorted oldest → newest.
 */
export async function getPriceHistory(areaCode: string, days = 30): Promise<PriceHistorySeries[]> {
  const key = historyKey(areaCode);
  const all = await cacheHGetAll(key);
  if (!all) return [];

  const cutoff = cutoffDate(days);
  const byCrop = new Map<string, Array<{ date: string; price: number }>>();
  const meta = new Map<string, { currency: string; source: string; dataStatus: MarketDataStatus }>();

  for (const [field, raw] of Object.entries(all)) {
    const date = field.split(':')[0];
    if (date < cutoff) continue;
    try {
      const snapshot: PriceSnapshot = JSON.parse(raw);
      if (!byCrop.has(snapshot.crop)) byCrop.set(snapshot.crop, []);
      byCrop.get(snapshot.crop)!.push({ date: snapshot.date, price: snapshot.price });
      meta.set(snapshot.crop, {
        currency: snapshot.currency,
        source: snapshot.source,
        dataStatus: snapshot.dataStatus,
      });
    } catch {
      logger.warn(`Skipping corrupt price history entry for field ${field}`);
    }
  }

  const result: PriceHistorySeries[] = [];
  for (const [crop, series] of byCrop.entries()) {
    series.sort((a, b) => a.date.localeCompare(b.date));
    const m = meta.get(crop);
    result.push({
      crop,
      currency: m?.currency || '',
      source: m?.source || '',
      dataStatus: m?.dataStatus || 'unavailable',
      series,
    });
  }
  return result;
}
