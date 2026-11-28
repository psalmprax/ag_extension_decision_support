/**
 * Severe weather in the forecast, found per farm and recorded as alerts.
 *
 * Farms with coordinates are grouped into cells of 0.1 degree (about 11 km), one forecast
 * each. Farms without coordinates are grouped by district (else region) and looked up by
 * that name in the farmer's own country. "Severe" is the forecast's own classification
 * (Open-Meteo weather codes for heavy rain, violent showers, thunderstorm, hail, heavy
 * snow), not a threshold of ours. Each cell and day gives at most one alert (dedupe_key).
 *
 * Alerts are marked notify_farmers: they state a forecast and give no advice, so
 * farmerAlertDelivery may text them. Officers hear through the alert worker's alert
 * check; regional managers are told here when an alert is new.
 */
import { createHash } from 'crypto';
import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';
import { WeatherService, type WeatherData } from '@/services/weatherService';
import { logger } from '@/utils/logger';

/** Worst first: the condition named when a day has several. */
export const SEVERE_CONDITIONS = ['Thunderstorm with hail', 'Violent rain showers', 'Thunderstorm', 'Heavy rain', 'Heavy snow'] as const;
const HIGH_SEVERITY = new Set<string>(['Thunderstorm with hail', 'Violent rain showers']);
/** Today and tomorrow: further out, a three-day forecast changes too often to text farmers about. */
const DAYS_AHEAD = 2;
const MAX_GROUPS_PER_RUN = 200;

export interface WeatherFarm {
    id: string;
    tenant_id: string | null;
    location_lat: string | number | null;
    location_lng: string | number | null;
    district: string | null;
    region: string | null;
    country: string | null;
}

export interface FarmGroup {
    key: string;
    tenantId: string | null;
    point: { lat: number; lng: number } | null;
    place: string;
    country: string | null;
    region: string | null;
    farmerIds: string[];
}

function mostCommon(values: Array<string | null>): string | null {
    const counts = new Map<string, number>();
    for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    let best: string | null = null;
    for (const [value, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = value;
    return best;
}

/** Farms that share one forecast: the same tenant and the same 0.1-degree cell, or the same named place. */
export function groupFarms(farms: WeatherFarm[]): FarmGroup[] {
    const groups = new Map<string, { farms: WeatherFarm[]; point: FarmGroup['point'] }>();
    for (const farm of farms) {
        const lat = Number(farm.location_lat);
        const lng = Number(farm.location_lng);
        const hasPoint = farm.location_lat !== null && farm.location_lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
        const place = farm.district || farm.region;
        if (!hasPoint && !place) continue;
        const cell = hasPoint ? `${(Math.round(lat * 10) / 10).toFixed(1)},${(Math.round(lng * 10) / 10).toFixed(1)}` : `${place}|${farm.country ?? ''}`;
        const key = `${farm.tenant_id ?? 'none'}|${cell}`;
        const group = groups.get(key) ?? { farms: [], point: hasPoint ? { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 } : null };
        group.farms.push(farm);
        groups.set(key, group);
    }
    return [...groups.entries()].map(([key, { farms: members, point }]) => ({
        key,
        tenantId: members[0].tenant_id,
        point,
        place: mostCommon(members.map(f => f.district || f.region)) ?? 'your area',
        country: mostCommon(members.map(f => f.country)),
        region: mostCommon(members.map(f => f.region)),
        farmerIds: members.map(f => f.id),
    }));
}

export interface SevereDay { date: string; condition: string; rainMm: number | null }

/** The severe days in a forecast (today and tomorrow), each with its worst condition. */
export function severeDays(weather: WeatherData): SevereDay[] {
    return weather.forecast.slice(0, DAYS_AHEAD).flatMap(day => {
        if (!(SEVERE_CONDITIONS as readonly string[]).includes(day.condition)) return [];
        const rain = day.precipitationMm;
        return [{ date: day.date, condition: day.condition, rainMm: rain !== undefined && Number.isFinite(rain) ? Math.round(rain) : null }];
    });
}

async function forecastFor(group: FarmGroup): Promise<WeatherData> {
    if (group.point) return WeatherService.getByCoordinates(group.point.lat, group.point.lng);
    return WeatherService.getByLocation(group.country ? `${group.place}, ${group.country}` : group.place);
}

async function recordAlert(group: FarmGroup, day: SevereDay): Promise<string | null> {
    const dedupeKey = `weather:${day.date}:${createHash('sha256').update(group.key).digest('hex').slice(0, 24)}`;
    const rain = day.rainMm !== null ? `, about ${day.rainMm} mm of rain` : '';
    const { rows } = await query<{ id: string }>(
        `INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at,
                             notify_farmers, dedupe_key, expires_at, details)
         VALUES ('weather', $1, $2, $3, $4, $5, $6, TRUE, NOW(), TRUE, $7, ($8::date + INTERVAL '1 day'), $9)
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING id`,
        [
            HIGH_SEVERITY.has(day.condition) ? 'high' : 'medium',
            `${day.condition} forecast for ${group.place} on ${day.date}`,
            `Open-Meteo forecast for ${day.date}: ${day.condition}${rain}. ${group.farmerIds.length} farm(s) in the area.`,
            group.region ?? group.place,
            group.farmerIds,
            group.tenantId,
            dedupeKey,
            day.date,
            JSON.stringify({ source: 'Open-Meteo', date: day.date, condition: day.condition, rainMm: day.rainMm }),
        ],
    );
    return rows[0]?.id ?? null;
}

async function tellManagers(region: string | null, title: string, alertId: string): Promise<void> {
    const { rows } = await query<{ id: string }>(
        `SELECT id FROM users WHERE role = 'regional_manager' AND is_active = TRUE AND (region IS NULL OR region = $1)`,
        [region],
    );
    for (const manager of rows) {
        await notificationService.send({
            userId: manager.id,
            type: 'warning',
            title,
            message: 'Review the affected farms and field schedules.',
            channel: 'in_app',
            metadata: { alertId, region },
        });
    }
}

/** One pass: forecast each group of farms, record new severe-weather alerts. Returns how many were new. */
export async function checkSevereWeather(): Promise<number> {
    const { rows: farms } = await query<WeatherFarm>(
        `SELECT id, tenant_id, location_lat, location_lng, district, region, country
           FROM farmers WHERE is_active IS NOT FALSE`,
    );
    const groups = groupFarms(farms).slice(0, MAX_GROUPS_PER_RUN);
    let created = 0;
    for (const group of groups) {
        try {
            for (const day of severeDays(await forecastFor(group))) {
                const alertId = await recordAlert(group, day);
                if (!alertId) continue;
                created++;
                await tellManagers(group.region, `${day.condition} forecast for ${group.place} on ${day.date}`, alertId);
            }
        } catch (error) {
            logger.warn(`Forecast unavailable for ${group.place}:`, error instanceof Error ? error.message : error);
        }
    }
    logger.info(`Severe weather check: ${groups.length} forecast area(s), ${created} new alert(s)`);
    return created;
}
