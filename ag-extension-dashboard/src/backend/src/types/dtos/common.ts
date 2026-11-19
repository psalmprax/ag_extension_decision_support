/**
 * Shared helpers for DTO row→DTO mapping functions.
 *
 * Each helper is a pure transform used by the domain DTO modules:
 *   - `parseCount` for stringified pg `COUNT(*)` values
 *   - `parseDecimal` for string-or-number pg DECIMAL values
 *   - `toIso` for string-or-Date pg timestamps (JSON-safe ISO strings)
 */

/** Parse a pg `COUNT(*)` string into a number, defaulting to 0 for null. */
export function parseCount(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a string-or-number pg DECIMAL into a JS number (or null). */
export function parseDecimal(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a string-or-Date pg timestamp to an ISO string (or undefined). */
export function toIso(v: Date | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  return v;
}

/**
 * A pg DATE column as YYYY-MM-DD. node-postgres turns a DATE into a Date at
 * local midnight, so toIso() shifted it a day back on any server east of UTC
 * (a follow-up due 4 December read as 3 December at 23:00Z).
 */
export function toIsoDate(v: Date | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return v.slice(0, 10);
}
