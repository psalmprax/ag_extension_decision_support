/**
 * Crop stress seen from space, for the officer to check: a field with a crop in the ground
 * whose greenness last month was well below its long-term normal for that month.
 *
 * The flag is statistical, not agronomic: the NDVI standardised anomaly (Digital Earth
 * Africa, baseline 1984–2020) at or below -GREENNESS_FLAG_STD standard deviations (default 1).
 * The month's rain against the same month in earlier years (CHIRPS) is added as context, so
 * the officer can tell a dry spell from other causes. These alerts are never texted to
 * farmers as they stand (notify_farmers false): the officer looks, then writes to them.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { monthGreenness, monthRainfall, type MonthGreenness, type MonthRainfall } from '@/services/deafrica/satelliteFacts';

const FIELDS_PER_RUN = 100;
const DEFAULT_FLAG_STD = 1;

export function greennessFlagStd(): number {
    const n = Number(process.env.GREENNESS_FLAG_STD);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FLAG_STD;
}

export interface GrowingField {
    field_id: string;
    field_name: string;
    crop_name: string;
    farmer_id: string;
    tenant_id: string | null;
    region: string | null;
    lat: string | number;
    lng: string | number;
}

function monthName(month: string): string {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T00:00:00Z`));
}

/** The officer's account of the flag: what was measured, against what, from where. */
export function stressDescription(greenness: MonthGreenness, rainfall: MonthRainfall | null): string {
    const parts = [
        `${monthName(greenness.month)}: greenness ${Math.abs(greenness.stdAnomaly)} standard deviations below the 1984–2020 normal for the month (${greenness.source}).`,
    ];
    if (rainfall && rainfall.averageMm !== null && rainfall.percentOfAverage !== null) {
        parts.push(`Rain in ${monthName(rainfall.month)}: ${rainfall.rainMm} mm, ${rainfall.percentOfAverage}% of the average for the month over ${rainfall.baselineYears} earlier years (${rainfall.source}).`);
    } else if (rainfall) {
        parts.push(`Rain in ${monthName(rainfall.month)}: ${rainfall.rainMm} mm (${rainfall.source}).`);
    }
    parts.push('Check the field before advising the farmer.');
    return parts.join(' ');
}

async function growingFields(): Promise<GrowingField[]> {
    const { rows } = await query<GrowingField>(
        `SELECT DISTINCT ON (fl.id) fl.id AS field_id, fl.name AS field_name, cc.crop_name, f.id AS farmer_id, f.tenant_id, f.region,
                COALESCE(fl.latitude, f.location_lat) AS lat, COALESCE(fl.longitude, f.location_lng) AS lng
           FROM fields fl
           JOIN farmers f ON f.id = fl.farmer_id
           JOIN crop_cycles cc ON cc.field_id = fl.id AND cc.status IN ('planted', 'growing')
          WHERE fl.is_active IS NOT FALSE AND f.is_active IS NOT FALSE
            AND COALESCE(fl.latitude, f.location_lat) IS NOT NULL AND COALESCE(fl.longitude, f.location_lng) IS NOT NULL
          ORDER BY fl.id, cc.planting_date DESC NULLS LAST`,
    );
    // A different slice each day, so every field is looked at within a few days.
    const offset = rows.length > FIELDS_PER_RUN ? (Math.floor(Date.now() / 86_400_000) * FIELDS_PER_RUN) % rows.length : 0;
    return [...rows.slice(offset), ...rows.slice(0, offset)].slice(0, FIELDS_PER_RUN);
}

/** One pass over growing fields. Returns how many new flags were raised. */
export async function checkCropStress(): Promise<number> {
    const flagAt = -greennessFlagStd();
    let created = 0;
    for (const field of await growingFields()) {
        const lat = Number(field.lat);
        const lng = Number(field.lng);
        const greenness = await monthGreenness(lat, lng);
        if (!greenness || greenness.stdAnomaly > flagAt) continue;
        const rainfall = await monthRainfall(lat, lng);
        const belowAverageRain = rainfall?.percentOfAverage !== null && rainfall?.percentOfAverage !== undefined && rainfall.percentOfAverage < 100;
        const { rows } = await query<{ id: string }>(
            `INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at,
                                 notify_farmers, dedupe_key, expires_at, details)
             VALUES ('crop_stress', $1, $2, $3, $4, $5, $6, TRUE, NOW(), FALSE, $7, NOW() + INTERVAL '30 days', $8)
             ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
            [
                greenness.stdAnomaly <= 2 * flagAt ? 'high' : 'medium',
                `${belowAverageRain ? 'Less green than normal, with below-average rain' : 'Less green than normal'}: ${field.field_name} (${field.crop_name})`,
                stressDescription(greenness, rainfall),
                field.region,
                [field.farmer_id],
                field.tenant_id,
                `greenness:${field.field_id}:${greenness.month}`,
                JSON.stringify({ fieldId: field.field_id, crop: field.crop_name, greenness, rainfall }),
            ],
        );
        if (rows[0]) created++;
    }
    if (created > 0) logger.info(`Crop stress check: ${created} field(s) flagged for officers`);
    return created;
}
