/**
 * Outbreak warnings for the farms next in line, for the officer to check.
 *
 * The outbreak service already finds clusters: at least ALERT_THRESHOLD diagnoses of one
 * disease on one crop in a district within two weeks, never fewer than its k-anonymity floor.
 * Each cluster becomes an alert naming the farmers who grow that crop now (planted or
 * growing) in the district and its neighbours, one alert per tenant and week. Diagnoses
 * are model results, not confirmed cases, so these are never texted to farmers as they
 * stand (notify_farmers false): the officer confirms, then writes to them.
 */
import { query } from '@/services/databaseService';
import { outbreakService, type OutbreakCluster } from '@/services/outbreakService';
import { logger } from '@/utils/logger';

/** ISO year and week, so one cluster gives at most one alert a week. */
export function isoWeek(now: Date): string {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekday = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - weekday);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface CropFarmer { farmer_id: string; tenant_id: string | null }

async function farmersGrowing(crop: string, districts: string[]): Promise<CropFarmer[]> {
    const { rows } = await query<CropFarmer>(
        `SELECT DISTINCT f.id AS farmer_id, f.tenant_id
           FROM farmers f
           JOIN fields fl ON fl.farmer_id = f.id AND fl.is_active IS NOT FALSE
           JOIN crop_cycles cc ON cc.field_id = fl.id AND cc.status IN ('planted', 'growing')
          WHERE f.is_active IS NOT FALSE AND f.district = ANY($1::text[]) AND LOWER(cc.crop_name) = LOWER($2)`,
        [districts, crop],
    );
    return rows;
}

async function recordCluster(cluster: OutbreakCluster, now: Date): Promise<number> {
    const neighbours = await outbreakService.getAdjacentDistricts(cluster.district);
    const districts = [cluster.district, ...neighbours];
    const byTenant = new Map<string, CropFarmer[]>();
    for (const farmer of await farmersGrowing(cluster.crop, districts)) {
        const key = farmer.tenant_id ?? 'none';
        byTenant.set(key, [...(byTenant.get(key) ?? []), farmer]);
    }
    let created = 0;
    for (const [tenant, farmers] of byTenant) {
        const { rows } = await query<{ id: string }>(
            `INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at,
                                 notify_farmers, dedupe_key, expires_at, details)
             VALUES ('outbreak', 'high', $1, $2, $3, $4, $5, TRUE, NOW(), FALSE, $6, NOW() + INTERVAL '14 days', $7)
             ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
            [
                `Possible ${cluster.diseaseLabel} on ${cluster.crop} in ${cluster.district}`,
                `${cluster.caseCount} diagnoses from ${cluster.distinctFarmers} farmers in ${cluster.district} in the last two weeks (model results, not yet confirmed). ` +
                    `${farmers.length} farmer(s) grow ${cluster.crop} in ${districts.join(', ')}. Confirm on a farm before warning them.`,
                cluster.district,
                farmers.map(f => f.farmer_id),
                tenant === 'none' ? null : tenant,
                `outbreak:${tenant}:${cluster.district}:${cluster.crop}:${cluster.diseaseLabel}:${isoWeek(now)}`.slice(0, 120),
                JSON.stringify({ crop: cluster.crop, disease: cluster.diseaseLabel, district: cluster.district, districts, caseCount: cluster.caseCount }),
            ],
        );
        if (rows[0]) created++;
    }
    return created;
}

/** One pass over the current clusters. Returns how many new warnings were raised. */
export async function checkOutbreakSpread(now: Date = new Date()): Promise<number> {
    let created = 0;
    for (const cluster of await outbreakService.getAlertedDistricts()) {
        created += await recordCluster(cluster, now);
    }
    if (created > 0) logger.info(`Outbreak check: ${created} warning(s) for officers to review`);
    return created;
}
