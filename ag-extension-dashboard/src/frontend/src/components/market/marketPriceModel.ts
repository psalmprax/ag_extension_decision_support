import type { MarketPricesResponse, PriceHistorySeries } from '@/api/priceService';
import { sortedCopy } from '@/lib/sortedCopy';

export interface PriceChartRow {
  crop: string;
  price: number;
  trendPct: number;
  formattedPrice: string;
  source: string;
}

/** "KES 4,200" → 4200, "NGN 85,000" → 85000, "$1,234.50" → 1234.5 */
export function parseNumericPrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/** "+3.2%" → 3.2, "-1.5%" → -1.5, "Stable" → 0 */
export function parseTrendPct(trend: string): number {
  const match = trend.match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/** The currency code a formatted price starts with ("KES 4,200" → "KES"), or null. */
export function priceCurrency(formattedPrice: string | undefined): string | null {
  return formattedPrice?.trim().match(/^([A-Z]{3})\b/)?.[1] ?? null;
}

export function toPriceRows(response: MarketPricesResponse | undefined): PriceChartRow[] {
  return (response?.data ?? []).map(item => ({
    crop: item.crop,
    price: parseNumericPrice(item.price),
    trendPct: parseTrendPct(item.trend),
    formattedPrice: item.price,
    source: item.source,
  }));
}

/** Signed change with one decimal; no sign on zero, which is not a rise. */
export function formatTrend(trendPct: number): string {
  const rounded = Math.round(trendPct * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

export interface HistoryChartModel {
  /** Crops in a fixed (alphabetical) order, so each keeps its colour. */
  series: PriceHistorySeries[];
  merged: Array<Record<string, string | number>>;
}

export function mergeHistorySeries(historyData?: PriceHistorySeries[]): HistoryChartModel {
  const series = sortedCopy(historyData ?? [], (a, b) => a.crop.localeCompare(b.crop));
  const dateMap = new Map<string, Record<string, string | number>>();
  for (const s of series) {
    for (const point of s.series) {
      if (!dateMap.has(point.date)) dateMap.set(point.date, { date: point.date });
      dateMap.get(point.date)![s.crop] = point.price;
    }
  }
  const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { series, merged };
}
