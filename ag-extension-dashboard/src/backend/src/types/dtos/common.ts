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
