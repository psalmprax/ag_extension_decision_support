/**
 * Rain in the forecast just before a harvest is due: a statement of fact for the farmer
 * ("rain is forecast on Thursday; your maize harvest is due around Saturday"), no advice, so it
 * is marked notify_farmers and goes out like the severe-weather alerts.
 *
 * "Rain" is the forecast's own class, moderate or heavier (Open-Meteo weather codes 63, 65,
 * 81, 82, 95, 96), on one of the next three days, for crop cycles whose expected harvest
 * date falls in the next seven days.
 */
import { query } from '@/services/databaseService';
import { WeatherService } from '@/services/weatherService';
import { logger } from '@/utils/logger';

export const HARVEST_RAIN_CONDITIONS = new Set<string>([
    'Moderate rain', 'Heavy rain', 'Moderate rain showers', 'Violent rain showers', 'Thunderstorm', 'Thunderstorm with hail',
]);
const CYCLES_PER_RUN = 200;

export interface HarvestCycle {
    cycle_id: string;
    crop_name: string;
    expected_harvest_date: Date;
    farmer_id: string;
    tenant_id: string | null;
    region: string | null;
    lat: string | number;
    lng: string | number;
}

async function cyclesDueSoon(): Promise<HarvestCycle[]> {
    const { rows } = await query<HarvestCycle>(
        `SELECT cc.id AS cycle_id, cc.crop_name, cc.expected_harvest_date, f.id AS farmer_id, f.tenant_id, f.region,
                COALESCE(fl.latitude, f.location_lat) AS lat, COALESCE(fl.longitude, f.location_lng) AS lng
           FROM crop_cycles cc
           JOIN fields fl ON fl.id = cc.field_id
           JOIN farmers f ON f.id = fl.farmer_id
          WHERE cc.status IN ('planted', 'growing')
            AND cc.expected_harvest_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            AND f.is_active IS NOT FALSE
            AND COALESCE(fl.latitude, f.location_lat) IS NOT NULL AND COALESCE(fl.longitude, f.location_lng) IS NOT NULL
          ORDER BY cc.expected_harvest_date
          LIMIT ${CYCLES_PER_RUN}`,
    );
    return rows;
}

/** One pass. Returns how many new alerts were recorded. */
export async function checkHarvestRain(): Promise<number> {
    let created = 0;
    for (const cycle of await cyclesDueSoon()) {
        try {
            const weather = await WeatherService.getByCoordinates(Number(cycle.lat), Number(cycle.lng));
            const day = weather.forecast.slice(0, 3).find(d => HARVEST_RAIN_CONDITIONS.has(d.condition));
            if (!day) continue;
            const harvestDate = new Date(cycle.expected_harvest_date).toISOString().slice(0, 10);
            const { rows } = await query<{ id: string }>(
                `INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at,
                                     notify_farmers, dedupe_key, expires_at, details)
                 VALUES ('harvest_rain', 'medium', $1, $2, $3, $4, $5, TRUE, NOW(), TRUE, $6, ($7::date + INTERVAL '1 day'), $8)
                 ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
                [
                    `${day.condition} forecast before the ${cycle.crop_name} harvest`,
                    `Open-Meteo forecast for ${day.date}: ${day.condition}. Expected harvest: ${harvestDate}.`,
                    cycle.region,
                    [cycle.farmer_id],
                    cycle.tenant_id,
                    `harvest-rain:${cycle.cycle_id}:${day.date}`,
                    day.date,
                    JSON.stringify({ source: 'Open-Meteo', date: day.date, condition: day.condition, crop: cycle.crop_name, harvestDate }),
                ],
            );
            if (rows[0]) created++;
        } catch (error) {
            logger.warn(`Forecast unavailable for crop cycle ${cycle.cycle_id}:`, error instanceof Error ? error.message : error);
        }
    }
    if (created > 0) logger.info(`Harvest rain check: ${created} new alert(s)`);
    return created;
}
