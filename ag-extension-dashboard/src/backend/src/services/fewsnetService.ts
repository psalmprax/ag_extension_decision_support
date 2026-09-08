import { logger } from '@/utils/logger';

/**
 * FEWS NET Food Data Warehouse (FDW) retail price snapshots.
 *
 * Free, keyless, ToS-permitted API for public price facts. Monthly staple
 * prices per reference market with USD normalization and market GPS.
 * V1 scope: Kenya retail, maize + beans — the two series verified live
 * against the API (unit: kg, currency: KES, source org: KNBS).
 *
 * Units differ from the FAOSTAT per-bag rows on purpose: these are per-kg
 * RETAIL medians across markets and must be rendered in their own section,
 * never mixed onto the same bar-chart axis.
 */

const FEWS_BASE = 'https://fdw.fews.net/api/marketpricefacts/';
const FETCH_TIMEOUT_MS = 20000;
const MONTHS_TO_PROBE = 4;

const KE_PRODUCTS = [
    { product: 'Maize Grain (White)', crop: 'White Maize' },
    { product: 'Beans (mixed)', crop: 'Dry Beans' },
] as const;

const NG_PRODUCTS = [
    { product: 'Maize Grain (White)', crop: 'White Maize' },
    { product: 'Millet (Pearl)', crop: 'Pearl Millet' },
    { product: 'Sorghum (White)', crop: 'White Sorghum' },
    { product: 'Cowpeas (White)', crop: 'White Cowpeas' },
    { product: 'Rice (Milled)', crop: 'Milled Rice' },
    { product: 'Yams', crop: 'Yams' },
] as const;

/**
 * Verified-live retail series per country (product names probed against the
 * FDW API 2026-09-08). Ghana omitted deliberately — its latest FEWS NET
 * retail observations are from 2014 and must not pose as live prices.
 * Uganda omitted — series end 2015.
 */
const COUNTRY_PRODUCTS: Record<string, { readonly product: string; readonly crop: string }[]> = {
    KE: [...KE_PRODUCTS],
    NG: [...NG_PRODUCTS],
};

export const FEWS_COUNTRIES = Object.keys(COUNTRY_PRODUCTS);

interface FewsPriceRow {
    period_date: string | null;
    market: string | null;
    value: number | null;
    unit: string | null;
    currency: string | null;
    pct_change_from_one_month_ago: number | null;
}

export interface FewsRetailSnapshot {
    crop: string;
    medianPrice: number;
    unit: string;
    currency: string;
    trendPct: number | null;
    periodDate: string;
    marketCount: number;
}

async function fetchJson(url: string): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const res = await Promise.race([
            fetch(url, { headers: { Accept: 'application/json' } }),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`FEWS NET fetch timed out: ${url}`)), FETCH_TIMEOUT_MS);
            }),
        ]);
        if (!res.ok) throw new Error(`FEWS NET responded ${res.status} for ${url}`);
        return (await res.json()) as unknown;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Month-end ISO dates, newest first (FEWS NET publishes monthly periods). */
function recentMonthEnds(count: number): string[] {
    const out: string[] = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 0; i < count; i++) {
        out.push(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10));
        cursor.setMonth(cursor.getMonth() - 1);
    }
    return out;
}

function asRows(payload: unknown): FewsPriceRow[] {
    const rows = Array.isArray(payload)
        ? payload
        : (payload as { results?: unknown }).results;
    if (!Array.isArray(rows)) return [];
    return rows as FewsPriceRow[];
}

function median(values: number[]): number | null {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

async function fetchMonth(country: string, product: string, periodDate: string): Promise<FewsPriceRow[]> {
    const url = `${FEWS_BASE}?country_code=${country}&product=${encodeURIComponent(product)}&price_type=Retail&format=json&period_date=${periodDate}`;
    return asRows(await fetchJson(url));
}

/** First month-end (newest first) with at least one numeric observation. */
async function fetchLatestMonth(country: string, product: string): Promise<{ rows: FewsPriceRow[]; periodDate: string } | null> {
    for (const periodDate of recentMonthEnds(MONTHS_TO_PROBE)) {
        try {
            const rows = (await fetchMonth(country, product, periodDate))
                .filter(r => typeof r.value === 'number' && Number.isFinite(r.value));
            if (rows.length > 0) return { rows, periodDate };
        } catch (err) {
            logger.warn(`FEWS NET month ${periodDate} unavailable for ${product}:`, err instanceof Error ? err.message : err);
        }
    }
    return null;
}

function summarize(product: string, crop: string, periodDate: string, rows: FewsPriceRow[]): FewsRetailSnapshot | null {
    const values = rows.map(r => r.value).filter((v): v is number => typeof v === 'number');
    const medianPrice = median(values);
    if (medianPrice === null) return null;
    const deltas = rows
        .map(r => r.pct_change_from_one_month_ago)
        .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
    return {
        crop,
        medianPrice: round1(medianPrice),
        unit: rows[0]?.unit || 'kg',
        currency: rows[0]?.currency || 'KES',
        trendPct: median(deltas) !== null ? round1(median(deltas) as number) : null,
        periodDate,
        marketCount: new Set(rows.map(r => r.market)).size,
    };
}

/**
 * Per-kg retail medians for a supported country (see COUNTRY_PRODUCTS) for
 * the latest available month. Returns null when the country is unsupported
 * or FEWS NET has no recent observations — callers fall through to their
 * next source, never to invented numbers.
 */
export async function getRetailSnapshot(country: string): Promise<{ country: string; snapshots: FewsRetailSnapshot[]; periodDate: string } | null> {
    const products = COUNTRY_PRODUCTS[country];
    if (!products) return null;

    const settled = await Promise.allSettled(
        products.map(async ({ product, crop }) => {
            const latest = await fetchLatestMonth(country, product);
            if (!latest) return null;
            return summarize(product, crop, latest.periodDate, latest.rows);
        })
    );

    const snapshots = settled
        .filter((r): r is PromiseFulfilledResult<FewsRetailSnapshot | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((s): s is FewsRetailSnapshot => s !== null);
    if (snapshots.length === 0) return null;

    // Snapshots may land on different months; report the newest.
    const periodDate = snapshots.map(s => s.periodDate).sort().reverse()[0];
    return { country, snapshots, periodDate };
}
