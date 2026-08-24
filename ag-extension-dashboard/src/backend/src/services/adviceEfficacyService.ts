import { query } from './databaseService';
import { logger } from '@/utils/logger';

export type OutcomeVerdict =
    | 'resolved'
    | 'improved'
    | 'unresolved'
    | 'worsened'
    | 'lost_to_followup';

export const OUTCOME_VERDICTS: OutcomeVerdict[] = [
    'resolved',
    'improved',
    'unresolved',
    'worsened',
    'lost_to_followup',
];

export interface OutcomeInput {
    visitId?: string | null;
    farmerId?: string | null;
    officerId: string;
    crop: string;
    adviceCategory: string;
    adviceSummary: string;
    outcome: OutcomeVerdict;
    followUpPhotoId?: string | null;
    officerNotes?: string | null;
}

export interface OutcomeRecord {
    id: string;
    visitId: string | null;
    farmerId: string | null;
    crop: string;
    adviceCategory: string;
    outcome: OutcomeVerdict;
    measuredAt: Date;
}

interface OutcomeRow {
    id: string;
    visit_id: string | null;
    farmer_id: string | null;
    crop: string;
    advice_category: string;
    outcome: string;
    measured_at: Date;
}

interface SummaryRow {
    crop: string;
    advice_category: string;
    total: string;
    resolved: string;
    improved: string;
}

const mapOutcomeRow = (row: OutcomeRow): OutcomeRecord => ({
    id: row.id,
    visitId: row.visit_id,
    farmerId: row.farmer_id,
    crop: row.crop,
    adviceCategory: row.advice_category,
    outcome: row.outcome as OutcomeVerdict,
    measuredAt: row.measured_at,
});

export const SUCCESS_VERDICTS: OutcomeVerdict[] = ['resolved', 'improved'];

export const adviceEfficacyService = {
    async recordOutcome(input: OutcomeInput): Promise<OutcomeRecord> {
        const { rows } = await query<OutcomeRow>(
            `INSERT INTO recommendation_outcomes
                 (visit_id, farmer_id, officer_id, crop, advice_category, advice_summary, outcome, follow_up_photo_id, officer_notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, visit_id, farmer_id, crop, advice_category, outcome, measured_at`,
            [
                input.visitId || null,
                input.farmerId || null,
                input.officerId,
                input.crop,
                input.adviceCategory,
                input.adviceSummary,
                input.outcome,
                input.followUpPhotoId || null,
                input.officerNotes || null,
            ]
        );
        logger.info(`Outcome recorded for visit ${input.visitId ?? '-'}: ${input.outcome}`);
        return mapOutcomeRow(rows[0]);
    },

    async getEfficacySummary(options: { officerId?: string; crop?: string; days?: number } = {}) {
        const days = options.days ?? 90;
        const params: unknown[] = [days];
        const clauses: string[] = ['measured_at >= NOW() - ($1 || \' days\')::interval'];

        if (options.officerId) {
            params.push(options.officerId);
            clauses.push(`officer_id = $${params.length}`);
        }
        if (options.crop) {
            params.push(options.crop);
            clauses.push(`crop = $${params.length}`);
        }

        const { rows } = await query<SummaryRow>(
            `SELECT crop, advice_category,
                    COUNT(*)::text AS total,
                    COUNT(*) FILTER (WHERE outcome = 'resolved')::text AS resolved,
                    COUNT(*) FILTER (WHERE outcome = 'improved')::text AS improved
             FROM recommendation_outcomes
             WHERE ${clauses.join(' AND ')}
             GROUP BY crop, advice_category
             ORDER BY COUNT(*) DESC`,
            params
        );

        const byCategory = rows.map(row => {
            const total = Number(row.total);
            const success = Number(row.resolved) + Number(row.improved);
            return {
                crop: row.crop,
                adviceCategory: row.advice_category,
                total,
                successCount: success,
                successRate: total > 0 ? Math.round((success / total) * 100) : 0,
            };
        });

        const total = byCategory.reduce((sum, c) => sum + c.total, 0);
        const successCount = byCategory.reduce((sum, c) => sum + c.successCount, 0);

        return {
            windowDays: days,
            totalOutcomes: total,
            successCount,
            overallSuccessRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
            byCategory,
        };
    },

    async getFollowUpQueue(officerId: string, withinDays = 14) {
        // Completed advice visits, past their follow-up window, with no outcome recorded yet.
        const { rows } = await query<{
            id: string;
            farmer_id: string | null;
            farmer_name: string | null;
            visit_date: Date | null;
            notes: string | null;
            days_overdue: string;
            lat: number | null;
            lng: number | null;
            vital_score: number | null;
        }>(
            `SELECT v.id, v.farmer_id,
                    (f.first_name || ' ' || f.last_name) AS farmer_name,
                    COALESCE(v.completed_at, v.scheduled_at) AS visit_date,
                    v.notes,
                    f.location_lat AS lat,
                    f.location_lng AS lng,
                    f.vital_score AS vital_score,
                    EXTRACT(day FROM NOW() - COALESCE(v.completed_at, v.scheduled_at))::text AS days_overdue
             FROM visits v
             LEFT JOIN farmers f ON f.id = v.farmer_id
             WHERE v.officer_id = $1
               AND v.status = 'completed'
               AND COALESCE(v.completed_at, v.scheduled_at) <= NOW() - ($2 || ' days')::interval
               AND (v.follow_up_required = true OR v.notes IS NOT NULL OR v.outcomes IS NOT NULL)
               AND NOT EXISTS (SELECT 1 FROM recommendation_outcomes ro WHERE ro.visit_id = v.id)
             ORDER BY visit_date ASC
             LIMIT 100`,
            [officerId, String(withinDays)]
        );

        return rows.map(row => ({
            visitId: row.id,
            farmerId: row.farmer_id,
            farmerName: row.farmer_name,
            visitDate: row.visit_date,
            notes: row.notes,
            daysOverdue: Number(row.days_overdue),
            lat: row.lat !== null ? Number(row.lat) : null,
            lng: row.lng !== null ? Number(row.lng) : null,
            vitalScore: row.vital_score !== null ? Number(row.vital_score) : null,
        }));
    },
};
