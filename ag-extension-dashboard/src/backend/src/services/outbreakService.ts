import { query } from './databaseService';
import { logger } from '@/utils/logger';

export interface OutbreakCluster {
    district: string;
    crop: string;
    diseaseLabel: string;
    caseCount: number;
    distinctFarmers: number;
    firstSeen: Date;
    lastSeen: Date;
}

interface ClusterRow {
    district: string;
    crop: string;
    disease_label: string;
    case_count: string;
    distinct_farmers: string;
    first_seen: Date;
    last_seen: Date;
}

/** k-anonymity floor: never surface a cluster smaller than this. */
export const K_ANONYMITY_MIN = 3;
const TRAILING_DAYS = 14;
/** Cases within a district+crop+disease window that trigger an alert. */
export const ALERT_THRESHOLD = 5;

export interface DiagnosisEventInput {
    farmerId?: string | null;
    district?: string | null;
    crop: string;
    diseaseLabel: string;
    confidence?: number | null;
    source?: string;
}

export const outbreakService = {
    async recordDiagnosisEvent(input: DiagnosisEventInput): Promise<void> {
        await query(
            `INSERT INTO diagnosis_events (farmer_id, district, crop, disease_label, confidence, source)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [input.farmerId || null, input.district || null, input.crop, input.diseaseLabel, input.confidence ?? null, input.source || 'extension_tool']
        );
    },

    /**
     * Aggregated clusters over the trailing window. k-anonymity is enforced in
     * SQL — clusters with fewer distinct farmers than the floor never leave the db.
     */
    async getClusters(options: { days?: number; bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number } } = {}): Promise<OutbreakCluster[]> {
        const days = options.days ?? TRAILING_DAYS;
        const bboxClause = options.bbox
            ? 'AND EXISTS (SELECT 1 FROM farmers f2 WHERE f2.id = de.farmer_id AND f2.location_lat BETWEEN $3 AND $4 AND f2.location_lng BETWEEN $5 AND $6)'
            : '';
        const params: unknown[] = [String(days), K_ANONYMITY_MIN, ...(options.bbox ? [options.bbox.minLat, options.bbox.maxLat, options.bbox.minLng, options.bbox.maxLng] : [])];

        const { rows } = await query<ClusterRow>(
            `SELECT de.district, de.crop, de.disease_label,
                    COUNT(*)::text AS case_count,
                    COUNT(DISTINCT de.farmer_id)::text AS distinct_farmers,
                    MIN(de.created_at) AS first_seen,
                    MAX(de.created_at) AS last_seen
             FROM diagnosis_events de
             WHERE de.created_at >= NOW() - ($1 || ' days')::interval
               AND de.district IS NOT NULL
               ${bboxClause}
             GROUP BY de.district, de.crop, de.disease_label
             HAVING COUNT(DISTINCT de.farmer_id) >= $2
             ORDER BY COUNT(*) DESC
             LIMIT 200`,
            params
        );

        return rows.map(row => ({
            district: row.district,
            crop: row.crop,
            diseaseLabel: row.disease_label,
            caseCount: Number(row.case_count),
            distinctFarmers: Number(row.distinct_farmers),
            firstSeen: row.first_seen,
            lastSeen: row.last_seen,
        }));
    },

    /**
     * Districts that crossed the alert threshold in the trailing window.
     */
    async getAlertedDistricts(): Promise<OutbreakCluster[]> {
        const clusters = await this.getClusters({ days: TRAILING_DAYS });
        return clusters.filter(c => c.caseCount >= ALERT_THRESHOLD);
    },

    /**
     * Districts adjacent (same region fallback, curated table override) to an
     * alerted district — officers there should receive a warning.
     */
    async getAdjacentDistricts(district: string): Promise<string[]> {
        const curated = await query<{ adjacent_district: string }>(
            'SELECT adjacent_district FROM district_adjacency WHERE district = $1',
            [district]
        );
        if (curated.rows.length > 0) return curated.rows.map(r => r.adjacent_district);

        // Fallback: districts in the same region count as adjacent.
        const { rows } = await query<{ district: string }>(
            `SELECT DISTINCT f2.district FROM farmers f1
             JOIN farmers f2 ON f1.region = f2.region
             WHERE f1.district = $1 AND f2.district IS NOT NULL AND f2.district != $1`,
            [district]
        );
        return rows.map(r => r.district);
    },

    /**
     * Officers to warn about an outbreak: officers assigned farmers in the
     * affected district plus officers in adjacent districts.
     */
    async getOfficersToWarn(district: string): Promise<string[]> {
        const adjacent = await this.getAdjacentDistricts(district);
        const { rows } = await query<{ email: string }>(
            `SELECT DISTINCT u.email FROM users u
             JOIN farmers f ON f.assigned_officer_id = u.id
             WHERE u.email IS NOT NULL
               AND (f.district = $1 OR f.district = ANY($2::varchar[]))`,
            [district, adjacent]
        );
        return rows.map(r => r.email);
    },

    /** Daily rollup: log alerts for threshold-crossing clusters (dispatch via email digest). */
    async rollupAndNotify(sendEmail: (to: string, subject: string, text: string) => Promise<void>): Promise<number> {
        const alerts = await this.getAlertedDistricts();
        let sent = 0;
        for (const alert of alerts) {
            try {
                const officers = await this.getOfficersToWarn(alert.district);
                for (const email of officers) {
                    await sendEmail(
                        email,
                        `Outbreak alert: ${alert.diseaseLabel} in ${alert.district}`,
                        `GPExts outbreak intelligence: ${alert.caseCount} cases of ${alert.diseaseLabel} on ${alert.crop} reported in ${alert.district} over the last ${TRAILING_DAYS} days. Inspect at-risk fields in your area and report new cases through the app.`
                    );
                    sent += 1;
                }
            } catch (error) {
                logger.error(`Outbreak notification failed for ${alert.district}:`, error);
            }
        }
        return sent;
    },
};
