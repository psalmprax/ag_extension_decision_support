/**
 * Number formatting for charts. Units are always stated by the chart that knows them; nothing
 * here guesses a unit from a series name.
 */
import { appLocale } from '@/lib/appLocale';

/** Grouped number with up to `digits` decimals: 12,500 or 3.5. */
export function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat(appLocale(), { maximumFractionDigits: digits }).format(value);
}

/** Short axis label that keeps one decimal: 3.5K, 12K, 1.2M. Never rounds 3,500 to "4K". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(appLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Money in a known currency (KES 12,500). Falls back to the code and a number for unknown codes. */
export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(appLocale(), { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${formatNumber(value, 0)}`;
  }
}

/** A whole-number count with a singular or plural noun: "1 visit", "12 visits". */
export function formatCount(value: number, singular: string, plural: string): string {
  return `${formatNumber(value, 0)} ${value === 1 ? singular : plural}`;
}

/** A share in percent: 38%, 12.5%. */
export function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`;
}

/** Day label for a date axis: "23 Nov". Leaves anything that is not a date as it is. */
export function formatDay(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
}

/** Signed change in percent between a first and last value, or null when it cannot be worked out. */
export function percentChange(first: number, last: number): number | null {
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}
