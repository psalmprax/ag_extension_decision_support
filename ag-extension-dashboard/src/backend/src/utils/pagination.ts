/**
 * Page size and offset from a query string. Values that are missing, not whole numbers
 * or out of range fall back or are clamped: `?limit=abc` once reached SQL as NaN (a 500),
 * and `?limit=1000000` returned a whole table in one response.
 */
export function pageLimit(value: unknown, fallback: number, max = 200): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

export function pageOffset(value: unknown, max = 100_000): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, max);
}
