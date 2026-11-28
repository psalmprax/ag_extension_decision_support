/**
 * Point values from Digital Earth Africa's free map service (datacube-ows at
 * ows.digitalearth.africa), read with WMS GetFeatureInfo as JSON: the band values of one
 * pixel, for one date, plus the dates the layer has data for. No account or key is needed.
 *
 * Layer names are those in the DE Africa product pages: rainfall_chirps_monthly,
 * ndvi_anomaly, crop_mask, wofs_ls_summary_alltime, esa_worldcereal_*.
 *
 * Readings are kept in satellite_readings: a past date never changes, so it is fetched
 * once; the newest ("latest") is fetched again after a day.
 */
import axios from 'axios';
import { query } from '@/services/databaseService';
import { OUTBOUND_TIMEOUT_MS } from '@/utils/outboundTimeout';
import { logger } from '@/utils/logger';

export const DEAFRICA_WMS_URL = process.env.DEAFRICA_WMS_URL || 'https://ows.digitalearth.africa/wms';
const LATEST = 'latest';
const LATEST_REFRESH_MS = 24 * 60 * 60 * 1000;
/** Half the side of the tiny box asked for, in degrees (about 5 m); its centre pixel is the point. */
const HALF_BOX_DEG = 0.00005;

export type Bands = Record<string, number | null>;

export interface PointReading {
    /** YYYY-MM-DD the values are for; null when the layer has no data at the point. */
    date: string | null;
    bands: Bands;
    /** Every date the layer has data for at the point, oldest first (YYYY-MM-DD). */
    availableDates: string[];
}

function day(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    return match ? match[1] : null;
}

function bandValues(raw: unknown): Bands {
    const out: Bands = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
        out[name] = Number.isFinite(n) ? n : null;
    }
    return out;
}

/** The pixel's date, bands and available dates from a datacube-ows GetFeatureInfo answer. */
export function parseFeatureInfo(body: unknown): PointReading {
    const features = (body as { features?: Array<{ properties?: Record<string, unknown> }> } | null)?.features;
    const props = Array.isArray(features) && features[0]?.properties ? features[0].properties : {};
    // Newer datacube-ows nests per-date values under "data"; older answers keep them at the top.
    const entry = Array.isArray(props.data) && props.data[0] && typeof props.data[0] === 'object'
        ? props.data[0] as Record<string, unknown>
        : props;
    const dates = Array.isArray(props.data_available_for_dates)
        ? (props.data_available_for_dates as unknown[]).map(day).filter((d): d is string => d !== null).sort()
        : [];
    const bands = bandValues(entry.bands);
    return { date: Object.keys(bands).length > 0 ? day(entry.time) : null, bands, availableDates: dates };
}

/** The cache key of a point: five decimals (about 1 m), so the same field always hits the cache. */
export function pointKey(lat: number, lng: number): string {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

async function fetchPoint(layer: string, lat: number, lng: number, date?: string): Promise<PointReading> {
    const response = await axios.get(DEAFRICA_WMS_URL, {
        params: {
            service: 'WMS',
            version: '1.3.0',
            request: 'GetFeatureInfo',
            layers: layer,
            query_layers: layer,
            styles: '',
            format: 'image/png',
            info_format: 'application/json',
            // WMS 1.3.0 with EPSG:4326 takes the box as lat,lng order.
            crs: 'EPSG:4326',
            bbox: [lat - HALF_BOX_DEG, lng - HALF_BOX_DEG, lat + HALF_BOX_DEG, lng + HALF_BOX_DEG].join(','),
            width: 3,
            height: 3,
            i: 1,
            j: 1,
            ...(date ? { time: date } : {}),
        },
        timeout: OUTBOUND_TIMEOUT_MS,
    });
    return parseFeatureInfo(response.data);
}

interface CachedRow { observed_on: string | null; bands: Bands | null; available_dates: string[] | null; fetched_at: Date }

/** One layer at one point, for a date (YYYY-MM-DD) or the newest. Throws when the service fails. */
export async function readPoint(layer: string, lat: number, lng: number, date?: string): Promise<PointReading> {
    const key = pointKey(lat, lng);
    const requested = date ?? LATEST;
    const { rows } = await query<CachedRow>(
        `SELECT observed_on, bands, available_dates, fetched_at FROM satellite_readings
          WHERE layer = $1 AND point_key = $2 AND requested_on = $3`,
        [layer, key, requested],
    );
    const cached = rows[0];
    if (cached && (date || Date.now() - new Date(cached.fetched_at).getTime() < LATEST_REFRESH_MS)) {
        return { date: cached.observed_on, bands: cached.bands ?? {}, availableDates: cached.available_dates ?? [] };
    }
    const reading = await fetchPoint(layer, lat, lng, date);
    await query(
        `INSERT INTO satellite_readings (layer, point_key, requested_on, observed_on, bands, available_dates, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (layer, point_key, requested_on)
         DO UPDATE SET observed_on = EXCLUDED.observed_on, bands = EXCLUDED.bands,
                       available_dates = EXCLUDED.available_dates, fetched_at = NOW()`,
        [layer, key, requested, reading.date, JSON.stringify(reading.bands), JSON.stringify(reading.availableDates)],
    );
    return reading;
}

/** readPoint, or null (logged) when Digital Earth Africa cannot be reached. */
export async function readPointOrNull(layer: string, lat: number, lng: number, date?: string): Promise<PointReading | null> {
    try {
        return await readPoint(layer, lat, lng, date);
    } catch (error) {
        logger.warn(`Digital Earth Africa ${layer} unavailable at ${pointKey(lat, lng)}:`, error instanceof Error ? error.message : error);
        return null;
    }
}
