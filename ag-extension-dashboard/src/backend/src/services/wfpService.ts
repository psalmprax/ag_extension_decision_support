import { logger } from '@/utils/logger';

/**
 * WFP VAM food prices via HDX per-country CSVs (humanitarian-open, no key).
 *
 * Monthly retail medians per crop, normalized to per-kg. Complements the
 * FEWS NET layer: WFP covers Uganda (FEWS series end 2015) and adds
 * Nigeria depth (millet, sorghum, rice, yams). Ghana excluded deliberately —
 * its HDX file's latest observations are from 2023-07 and must not pose
 * as live prices.
 *
 * Units differ from the FAOSTAT per-bag rows on purpose: per-kg RETAIL
 * medians render in the snapshot section only, never the bar-chart axis.
 */

const HDX_API = 'https://data.humdata.org/api/3/action/package_show';
const FETCH_TIMEOUT_MS = 60000;
const URL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DATA_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const WFP_DATASETS: Record<string, string> = {
    KE: 'wfp-food-prices-for-kenya',
    NG: 'wfp-food-prices-for-nigeria',
    UG: 'wfp-food-prices-for-uganda',
};

/** Verified commodity names per country (probed against live HDX files 2026-09-08). */
const WFP_CROPS: Record<string, Array<{ commodity: string; crop: string }>> = {
    KE: [
        { commodity: 'Maize (white)', crop: 'White Maize' },
        { commodity: 'Beans (dry)', crop: 'Dry Beans' },
        { commodity: 'Sorghum', crop: 'Sorghum' },
    ],
    NG: [
        { commodity: 'Maize (white)', crop: 'White Maize' },
        { commodity: 'Millet', crop: 'Millet' },
        { commodity: 'Sorghum', crop: 'Sorghum' },
        { commodity: 'Sorghum (white)', crop: 'Sorghum' },
        { commodity: 'Cowpeas (white)', crop: 'White Cowpeas' },
        { commodity: 'Beans (white)', crop: 'White Beans' },
        { commodity: 'Rice (local)', crop: 'Local Rice' },
        { commodity: 'Yams', crop: 'Yams' },
    ],
    UG: [
        { commodity: 'Maize (white)', crop: 'White Maize' },
        { commodity: 'Beans', crop: 'Beans' },
        { commodity: 'Sorghum', crop: 'Sorghum' },
        { commodity: 'Millet', crop: 'Millet' },
        { commodity: 'Cassava (fresh)', crop: 'Fresh Cassava' },
    ],
};

export const WFP_COUNTRIES = Object.keys(WFP_DATASETS);

export interface WfpSnapshot {
    crop: string;
    medianPrice: number;
    unit: string;
    currency: string;
    trendPct: number | null;
    periodDate: string;
    marketCount: number;
}

interface WfpRow {
    date: string;
    market: string;
    commodity: string;
    unit: string;
    pricetype: string;
    priceflag: string;
    currency: string;
    price: number;
}

/** Signed S3 download URLs expire — discover the CSV URL at runtime, cache 24h. */
const urlCache = new Map<string, { url: string; at: number }>();
const dataCache = new Map<string, { rows: WfpRow[]; at: number }>();

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            fetch(url, { headers: { Accept: '*/*' } }),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`WFP fetch timed out: ${url.slice(0, 80)}`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

// Directly unit-tested in wfpService.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
export async function resolveCsvUrl(country: string): Promise<string | null> {
    const slug = WFP_DATASETS[country];
    if (!slug) return null;
    const cached = urlCache.get(country);
    if (cached && Date.now() - cached.at < URL_CACHE_TTL_MS) return cached.url;
    try {
        const res = await fetchWithTimeout(`${HDX_API}?id=${slug}`, 20000);
        if (!res.ok) return null;
        const body = (await res.json()) as { result?: { resources?: Array<{ format?: string; url?: string }> } };
        const csv = body.result?.resources?.find(r => (r.format || '').toUpperCase() === 'CSV' && r.url);
        if (!csv?.url) return null;
        urlCache.set(country, { url: csv.url, at: Date.now() });
        return csv.url;
    } catch (err) {
        logger.warn(`WFP dataset lookup failed for ${country}:`, err instanceof Error ? err.message : err);
        return null;
    }
}

/** Minimal CSV parser (handles quoted fields + CRLF); WFP files are flat. */
// Directly unit-tested in wfpService.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '"') {
            const [value, next] = readQuotedField(text, i);
            field += value;
            i = next;
        } else if (c === ',') {
            row.push(field); field = ''; i++;
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            pushRow(rows, row, field);
            row = []; field = ''; i++;
        } else {
            field += c; i++;
        }
    }
    pushRow(rows, row, field);
    return rows;
}

function readQuotedField(text: string, start: number): [string, number] {
    let value = '';
    let i = start + 1;
    while (i < text.length) {
        if (text[i] === '"') {
            if (text[i + 1] === '"') { value += '"'; i += 2; }
            else return [value, i + 1];
        } else {
            value += text[i]; i++;
        }
    }
    return [value, i];
}

function pushRow(rows: string[][], row: string[], field: string): void {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
}

/**
 * Parse 'KG' / '90 KG' / '2.5 KG' / '400 G' into a per-kg divisor.
 * Returns null for non-mass units (L, Unit, Packet…) — those rows are
 * excluded from per-kg medians rather than converted dishonestly.
 */
// Directly unit-tested in wfpService.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
export function kgDivisor(unit: string): number | null {
    const m = unit.trim().match(/^([\d.]+)?\s*(kg|g)\s*$/i);
    if (!m) return null;
    const amount = m[1] ? Number(m[1]) : 1;
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return m[2].toLowerCase() === 'g' ? amount / 1000 : amount;
}

function toRows(records: string[][]): WfpRow[] {
    if (records.length < 2) return [];
    const head = records[0].map(h => h.trim().toLowerCase());
    const idx = (name: string) => head.indexOf(name);
    const out: WfpRow[] = [];
    for (const r of records.slice(1)) {
        const price = Number(r[idx('price')]);
        if (!Number.isFinite(price)) continue;
        out.push({
            date: (r[idx('date')] || '').slice(0, 10),
            market: r[idx('market')] || '',
            commodity: r[idx('commodity')] || '',
            unit: r[idx('unit')] || '',
            pricetype: r[idx('pricetype')] || '',
            priceflag: r[idx('priceflag')] || '',
            currency: r[idx('currency')] || '',
            price,
        });
    }
    return out;
}

async function loadRows(country: string): Promise<WfpRow[] | null> {
    const cached = dataCache.get(country);
    if (cached && Date.now() - cached.at < DATA_CACHE_TTL_MS) return cached.rows;
    const url = await resolveCsvUrl(country);
    if (!url) return null;
    try {
        const res = await fetchWithTimeout(url);
        if (!res.ok) return null;
        const rows = toRows(parseCsv(await res.text()));
        dataCache.set(country, { rows, at: Date.now() });
        return rows;
    } catch (err) {
        logger.warn(`WFP CSV fetch failed for ${country}:`, err instanceof Error ? err.message : err);
        return null;
    }
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

function eligibleRows(rows: WfpRow[]): WfpRow[] {
    return rows.filter(r =>
        r.pricetype === 'Retail' &&
        r.priceflag.includes('actual') &&
        kgDivisor(r.unit) !== null
    );
}

function latestDates(rows: WfpRow[]): string[] {
    return [...new Set(rows.map(r => r.date))].filter(Boolean).sort().reverse();
}

function perKg(values: WfpRow[]): number[] {
    return values.map(r => r.price / (kgDivisor(r.unit) as number));
}

function summarizeCrop(
    eligible: WfpRow[],
    commodity: string,
    crop: string,
    latest: string,
    previous: string | null
): WfpSnapshot | null {
    const inMonth = (date: string) => eligible.filter(r => r.date === date && r.commodity === commodity);
    const med = median(perKg(inMonth(latest)));
    if (med === null) return null;
    let trendPct: number | null = null;
    if (previous) {
        const prevMed = median(perKg(inMonth(previous)));
        if (prevMed !== null && prevMed !== 0) trendPct = round1(((med - prevMed) / prevMed) * 100);
    }
    const sample = inMonth(latest)[0];
    return {
        crop,
        medianPrice: round1(med),
        unit: 'kg',
        currency: sample?.currency || '',
        trendPct,
        periodDate: latest,
        marketCount: new Set(inMonth(latest).map(r => r.market)).size,
    };
}

/**
 * Per-kg retail medians for a supported country for the latest month with
 * actual observations. Trend = median % change vs the previous observed
 * month. Null when unsupported or unreachable — never invented numbers.
 */
export async function getWfpSnapshot(country: string): Promise<{ country: string; snapshots: WfpSnapshot[]; periodDate: string } | null> {
    const crops = WFP_CROPS[country];
    if (!crops) return null;
    const rows = await loadRows(country);
    if (!rows || rows.length === 0) return null;

    const eligible = eligibleRows(rows);
    const dates = latestDates(eligible);
    if (dates.length === 0) return null;
    const latest = dates[0];
    const previous = dates[1] ?? null;

    const snapshots: WfpSnapshot[] = [];
    for (const { commodity, crop } of crops) {
        const summary = summarizeCrop(eligible, commodity, crop, latest, previous);
        if (summary) snapshots.push(summary);
    }
    if (snapshots.length === 0) return null;
    return { country, snapshots, periodDate: latest };
}

// Directly unit-tested in wfpService.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
export function clearWfpCaches(): void {
    urlCache.clear();
    dataCache.clear();
}
