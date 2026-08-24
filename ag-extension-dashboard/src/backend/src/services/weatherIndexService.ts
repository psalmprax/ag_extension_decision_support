import { NasaPowerService, DailyPoint } from './nasaPowerService';
import { query } from './databaseService';
import { logger } from '@/utils/logger';

/**
 * Weather-index insurance data layer — computes the seasonal rainfall index
 * that index-insurance partners price and settle against. GPExts holds the
 * data pipeline (NASA POWER per district + farmer locations); the insurance
 * product itself requires a partner (business gate — see docs/specs).
 */

export interface RainfallIndex {
    district: string;
    seasonStart: string;
    seasonEnd: string;
    cumulativeRainMm: number;
    longTermMeanMm: number;
    indexPercent: number; // current season vs long-term mean (100 = normal)
    status: 'severe_deficit' | 'deficit' | 'normal' | 'above_normal';
}

// Simple growing-season window for the region (Nov–Mar main season).
const SEASON_START_MONTH = 10; // 0-indexed November
const SEASON_END_MONTH = 2; // 0-indexed March

function seasonWindow(now: Date): { start: Date; end: Date } {
    const year = now.getFullYear();
    const startMonth = now.getMonth() >= SEASON_START_MONTH ? SEASON_START_MONTH : SEASON_START_MONTH - 12;
    const start = new Date(year, startMonth, 1);
    const end = now.getMonth() <= SEASON_END_MONTH ? new Date(year, SEASON_END_MONTH + 1, 0) : new Date(year + 1, SEASON_START_MONTH - 1, 0);
    return { start, end: end > now ? now : end };
}

export function classifyIndex(indexPercent: number): RainfallIndex['status'] {
    if (indexPercent < 60) return 'severe_deficit';
    if (indexPercent < 80) return 'deficit';
    if (indexPercent <= 120) return 'normal';
    return 'above_normal';
}

export const weatherIndexService = {
    /**
     * Cumulative season rainfall vs the same window last year (long-term mean
     * proxy — NASA POWER history is fetched for the prior season).
     */
    async computeDistrictIndex(district: string, now = new Date()): Promise<RainfallIndex | null> {
        const { rows } = await query<{ lat: number; lng: number }>(
            `SELECT AVG(location_lat) AS lat, AVG(location_lng) AS lng
             FROM farmers WHERE district = $1 AND location_lat IS NOT NULL AND is_active = true`,
            [district]
        );
        if (rows.length === 0 || rows[0].lat === null) return null;
        const lat = Number(rows[0].lat);
        const lng = Number(rows[0].lng);

        const { start, end } = seasonWindow(now);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        const [current, prior] = await Promise.all([
            NasaPowerService.getDaily(lat, lng, fmt(start), fmt(end), ['PRECTOTCORR']),
            NasaPowerService.getDaily(lat, lng, fmt(new Date(start.getFullYear() - 1, start.getMonth(), 1)), fmt(new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())), ['PRECTOTCORR']),
        ]);

        const sum = (pts: DailyPoint[]) =>
            pts.reduce((s, p) => s + (typeof p.PRECTOTCORR === 'number' && Number.isFinite(p.PRECTOTCORR) ? p.PRECTOTCORR : 0), 0);

        const cumulativeRainMm = Math.round(sum(current) * 10) / 10;
        const longTermMeanMm = Math.round(sum(prior) * 10) / 10;
        if (longTermMeanMm <= 0) return null;

        const indexPercent = Math.round((cumulativeRainMm / longTermMeanMm) * 100);
        logger.debug(`Weather index ${district}: ${indexPercent}%`);
        return {
            district,
            seasonStart: fmt(start),
            seasonEnd: fmt(end),
            cumulativeRainMm,
            longTermMeanMm,
            indexPercent,
            status: classifyIndex(indexPercent),
        };
    },
};
