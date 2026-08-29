import { query } from './databaseService';

export interface OfficerScore {
    officerId: string;
    officerName: string;
    region: string | null;
    visitsCompleted: number;
    outcomesRecorded: number;
    efficacySuccessRate: number | null;
    farmersSupported: number;
    score: number;
    badges: string[];
}

interface LeaderboardRow {
    id: string;
    name: string | null;
    region: string | null;
    visits_completed: string;
    outcomes_recorded: string;
    success_count: string;
    farmers_supported: string;
}

export const officerGamificationService = {
    /**
     * 30-day officer leaderboard. Score = visits (×2) + outcomes recorded (×3)
     * + efficacy rate bonus. Badges recognize milestones, not just volume.
     */
    async getLeaderboard(days = 30, limit = 20): Promise<OfficerScore[]> {
        const { rows } = await query<LeaderboardRow>(
            `SELECT u.id,
                    (u.first_name || ' ' || u.last_name) AS name,
                    u.region,
                    COUNT(DISTINCT v.id)::text AS visits_completed,
                    COUNT(DISTINCT ro.id)::text AS outcomes_recorded,
                    COUNT(DISTINCT ro.id) FILTER (WHERE ro.outcome IN ('resolved','improved'))::text AS success_count,
                    COUNT(DISTINCT v.farmer_id)::text AS farmers_supported
             FROM users u
             LEFT JOIN visits v ON v.officer_id = u.id AND v.status = 'completed'
                   AND COALESCE(v.completed_at, v.scheduled_at) >= NOW() - ($1 || ' days')::interval
             LEFT JOIN recommendation_outcomes ro ON ro.officer_id = u.id
                   AND ro.measured_at >= NOW() - ($1 || ' days')::interval
             WHERE u.role IN ('extension_officer', 'regional_manager')
               AND COALESCE(u.is_demo, false) = false
             GROUP BY u.id, name, region
             HAVING COUNT(DISTINCT v.id) > 0 OR COUNT(DISTINCT ro.id) > 0
             ORDER BY COUNT(DISTINCT v.id) DESC
             LIMIT $2`,
            [String(days), limit]
        );

        return rows.map(row => {
            const visitsCompleted = Number(row.visits_completed);
            const outcomesRecorded = Number(row.outcomes_recorded);
            const successCount = Number(row.success_count);
            const efficacySuccessRate = outcomesRecorded > 0 ? Math.round((successCount / outcomesRecorded) * 100) : null;
            const farmersSupported = Number(row.farmers_supported);

            const score = visitsCompleted * 2 + outcomesRecorded * 3 + (efficacySuccessRate ?? 0) / 5;

            const badges: string[] = [];
            if (visitsCompleted >= 40) badges.push('Road Warrior');
            else if (visitsCompleted >= 20) badges.push('Field Regular');
            if (outcomesRecorded >= 15) badges.push('Evidence Collector');
            else if (outcomesRecorded >= 5) badges.push('Outcome Tracker');
            if (efficacySuccessRate !== null && outcomesRecorded >= 5 && efficacySuccessRate >= 70) badges.push('Trusted Advisor');
            if (farmersSupported >= 25) badges.push('Community Anchor');

            return {
                officerId: row.id,
                officerName: row.name || 'Officer',
                region: row.region,
                visitsCompleted,
                outcomesRecorded,
                efficacySuccessRate,
                farmersSupported,
                score: Math.round(score * 10) / 10,
                badges,
            };
        });
    },
};
