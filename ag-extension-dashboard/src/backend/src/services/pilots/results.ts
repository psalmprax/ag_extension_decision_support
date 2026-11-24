/**
 * What a pilot shows so far, per group: harvests before and after (kg per hectare), the
 * change, how much each group used the service during the season (visits, messages, replies,
 * advice), how quickly farmers' messages were answered, and how often farmers said they
 * followed the advice. The difference between groups comes with a 95% range and is flagged
 * as too early while either group has fewer than MIN_PER_GROUP farmers with both harvests.
 */
import { query } from '@/services/databaseService';

export const MIN_PER_GROUP = Number(process.env.PILOT_MIN_PER_GROUP || 30);

type Arm = 'service' | 'comparison';

export interface ArmResult {
    farmers: number;
    withBothHarvests: number;
    baselineKgPerHa: number | null;
    endlineKgPerHa: number | null;
    meanChangeKgPerHa: number | null;
    medianReplyMinutes: number | null;
    followups: { asked: number; yes: number; partly: number; no: number };
    use: ArmUse;
}

/** Use of the service by a group's farmers between season start and season end. */
export interface ArmUse {
    /** Completed officer visits, and how many of the group's farmers had at least one. */
    visits: number;
    farmersVisited: number;
    /** Messages farmers sent in their thread, and how many farmers sent at least one. */
    farmerMessages: number;
    farmersMessaging: number;
    officerReplies: number;
    aiReplies: number;
    /** Advice an officer recorded at a visit with its outcome. */
    adviceRecorded: number;
    /** AI advice sent to an officer for review before it reached the farmer. */
    adviceReviewed: number;
}

const NO_USE: ArmUse = {
    visits: 0, farmersVisited: 0, farmerMessages: 0, farmersMessaging: 0,
    officerReplies: 0, aiReplies: 0, adviceRecorded: 0, adviceReviewed: 0,
};

export interface PilotResults {
    service: ArmResult;
    comparison: ArmResult;
    /** Service minus comparison change in kg/ha, with a 95% range; null until both groups have data. */
    difference: { kgPerHa: number; low: number; high: number } | null;
    tooEarly: boolean;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const variance = (values: number[]) => {
    const m = mean(values);
    return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
};
const round = (value: number) => Math.round(value * 10) / 10;

interface FarmerHarvest { arm: Arm; baseline_kg: number | null; endline_kg: number | null; area_ha: number | null }

/** Per-hectare harvests; farmers without a farm size are left out of yields (not guessed). */
export function armYields(rows: FarmerHarvest[], arm: Arm) {
    const mine = rows.filter(r => r.arm === arm && r.area_ha && r.area_ha > 0);
    const perHa = (kg: number | null, area: number) => (kg === null ? null : kg / area);
    const baseline = mine.map(r => perHa(r.baseline_kg, r.area_ha!)).filter((v): v is number => v !== null);
    const endline = mine.map(r => perHa(r.endline_kg, r.area_ha!)).filter((v): v is number => v !== null);
    const changes = mine
        .filter(r => r.baseline_kg !== null && r.endline_kg !== null)
        .map(r => (r.endline_kg! - r.baseline_kg!) / r.area_ha!);
    return { baseline, endline, changes };
}

/** Difference in mean change with a normal-approximation 95% range (Welch). */
export function differenceInChange(service: number[], comparison: number[]) {
    if (service.length < 2 || comparison.length < 2) return null;
    const diff = mean(service) - mean(comparison);
    const se = Math.sqrt(variance(service) / service.length + variance(comparison) / comparison.length);
    return { kgPerHa: round(diff), low: round(diff - 1.96 * se), high: round(diff + 1.96 * se) };
}

async function replyMinutes(pilotId: string): Promise<Record<Arm, number | null>> {
    const { rows } = await query<{ arm: Arm; median: number | null }>(
        `SELECT pf.arm, percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.created_at - m.created_at)) / 60) AS median
           FROM pilot_farmers pf
           JOIN pilots p ON p.id = pf.pilot_id
           JOIN chat_conversations cv ON cv.farmer_id = pf.farmer_id AND cv.kind = 'farmer_thread'
           JOIN chat_messages m ON m.conversation_id = cv.id AND m.role IN ('user', 'farmer')
                AND m.created_at >= p.season_start AND m.created_at < p.season_end + INTERVAL '1 day'
           JOIN LATERAL (SELECT created_at FROM chat_messages x
                          WHERE x.conversation_id = cv.id AND x.created_at > m.created_at AND x.role IN ('officer', 'assistant')
                          ORDER BY x.created_at LIMIT 1) r ON true
          WHERE pf.pilot_id = $1
          GROUP BY pf.arm`,
        [pilotId],
    );
    const out: Record<Arm, number | null> = { service: null, comparison: null };
    rows.forEach(row => { out[row.arm] = row.median === null ? null : Math.round(Number(row.median)); });
    return out;
}

async function followupCounts(pilotId: string): Promise<Record<Arm, ArmResult['followups']>> {
    const { rows } = await query<{ arm: Arm; asked: string; yes: string; partly: string; no: string }>(
        `SELECT pf.arm, COUNT(a.asked_at) AS asked,
                COUNT(*) FILTER (WHERE a.answer = 'yes') AS yes,
                COUNT(*) FILTER (WHERE a.answer = 'partly') AS partly,
                COUNT(*) FILTER (WHERE a.answer = 'no') AS no
           FROM advice_followups a JOIN pilot_farmers pf ON pf.pilot_id = a.pilot_id AND pf.farmer_id = a.farmer_id
          WHERE a.pilot_id = $1 GROUP BY pf.arm`,
        [pilotId],
    );
    const empty = { asked: 0, yes: 0, partly: 0, no: 0 };
    const out: Record<Arm, ArmResult['followups']> = { service: { ...empty }, comparison: { ...empty } };
    rows.forEach(row => { out[row.arm] = { asked: Number(row.asked), yes: Number(row.yes), partly: Number(row.partly), no: Number(row.no) }; });
    return out;
}

const USE_SQL = `
WITH season AS (SELECT season_start AS from_at, season_end + INTERVAL '1 day' AS to_at FROM pilots WHERE id = $1),
pf AS (SELECT farmer_id, arm FROM pilot_farmers WHERE pilot_id = $1),
v AS (
    SELECT pf.arm, COUNT(*) AS visits, COUNT(DISTINCT vi.farmer_id) AS farmers
      FROM visits vi JOIN pf ON pf.farmer_id = vi.farmer_id, season
     WHERE vi.status = 'completed' AND COALESCE(vi.completed_at, vi.scheduled_at) >= season.from_at
       AND COALESCE(vi.completed_at, vi.scheduled_at) < season.to_at
     GROUP BY pf.arm),
m AS (
    SELECT pf.arm,
           COUNT(*) FILTER (WHERE cm.role IN ('user', 'farmer')) AS farmer_messages,
           COUNT(DISTINCT cv.farmer_id) FILTER (WHERE cm.role IN ('user', 'farmer')) AS farmers,
           COUNT(*) FILTER (WHERE cm.role = 'officer') AS officer_replies,
           COUNT(*) FILTER (WHERE cm.role = 'assistant') AS ai_replies
      FROM chat_conversations cv JOIN pf ON pf.farmer_id = cv.farmer_id
      JOIN chat_messages cm ON cm.conversation_id = cv.id, season
     WHERE cv.kind = 'farmer_thread' AND cm.created_at >= season.from_at AND cm.created_at < season.to_at
     GROUP BY pf.arm),
o AS (
    SELECT pf.arm, COUNT(*) AS n FROM recommendation_outcomes ro JOIN pf ON pf.farmer_id = ro.farmer_id, season
     WHERE ro.measured_at >= season.from_at AND ro.measured_at < season.to_at GROUP BY pf.arm),
r AS (
    SELECT pf.arm, COUNT(*) AS n FROM recommendation_reviews rr JOIN pf ON pf.farmer_id = rr.farmer_id, season
     WHERE rr.created_at >= season.from_at AND rr.created_at < season.to_at GROUP BY pf.arm)
SELECT arms.arm,
       COALESCE(v.visits, 0) AS visits, COALESCE(v.farmers, 0) AS farmers_visited,
       COALESCE(m.farmer_messages, 0) AS farmer_messages, COALESCE(m.farmers, 0) AS farmers_messaging,
       COALESCE(m.officer_replies, 0) AS officer_replies, COALESCE(m.ai_replies, 0) AS ai_replies,
       COALESCE(o.n, 0) AS advice_recorded, COALESCE(r.n, 0) AS advice_reviewed
  FROM (VALUES ('service'), ('comparison')) AS arms(arm)
  LEFT JOIN v ON v.arm = arms.arm LEFT JOIN m ON m.arm = arms.arm
  LEFT JOIN o ON o.arm = arms.arm LEFT JOIN r ON r.arm = arms.arm`;

interface UseRow {
    arm: Arm; visits: string; farmers_visited: string; farmer_messages: string; farmers_messaging: string;
    officer_replies: string; ai_replies: string; advice_recorded: string; advice_reviewed: string;
}

/** Visits, messages, replies and advice per group within the season, so uptake is read beside yield. */
export async function armUse(pilotId: string): Promise<Record<Arm, ArmUse>> {
    const { rows } = await query<UseRow>(USE_SQL, [pilotId]);
    const out: Record<Arm, ArmUse> = { service: { ...NO_USE }, comparison: { ...NO_USE } };
    rows.forEach(row => {
        out[row.arm] = {
            visits: Number(row.visits), farmersVisited: Number(row.farmers_visited),
            farmerMessages: Number(row.farmer_messages), farmersMessaging: Number(row.farmers_messaging),
            officerReplies: Number(row.officer_replies), aiReplies: Number(row.ai_replies),
            adviceRecorded: Number(row.advice_recorded), adviceReviewed: Number(row.advice_reviewed),
        };
    });
    return out;
}

export async function pilotResults(pilotId: string): Promise<PilotResults> {
    const { rows } = await query<FarmerHarvest>(
        'SELECT arm, baseline_kg, endline_kg, area_ha FROM pilot_farmers WHERE pilot_id = $1',
        [pilotId],
    );
    const [replies, followups, use] = await Promise.all([replyMinutes(pilotId), followupCounts(pilotId), armUse(pilotId)]);
    const build = (arm: Arm): ArmResult => {
        const y = armYields(rows, arm);
        return {
            farmers: rows.filter(r => r.arm === arm).length,
            withBothHarvests: y.changes.length,
            baselineKgPerHa: y.baseline.length ? round(mean(y.baseline)) : null,
            endlineKgPerHa: y.endline.length ? round(mean(y.endline)) : null,
            meanChangeKgPerHa: y.changes.length ? round(mean(y.changes)) : null,
            medianReplyMinutes: replies[arm],
            followups: followups[arm],
            use: use[arm],
        };
    };
    const service = build('service');
    const comparison = build('comparison');
    const difference = differenceInChange(armYields(rows, 'service').changes, armYields(rows, 'comparison').changes);
    return {
        service, comparison, difference,
        tooEarly: service.withBothHarvests < MIN_PER_GROUP || comparison.withBothHarvests < MIN_PER_GROUP,
    };
}

/** One row per farmer for researchers: no names or phone numbers, a stable pilot-only number instead. */
export async function pilotExportCsv(pilotId: string): Promise<string> {
    const { rows } = await query<{ n: string; arm: Arm; area_ha: number | null; baseline_kg: number | null; endline_kg: number | null; asked: string; yes: string; partly: string; no: string; messages: string; visits: string }>(
        `SELECT ROW_NUMBER() OVER (ORDER BY pf.assigned_at, pf.farmer_id) AS n, pf.arm, pf.area_ha, pf.baseline_kg, pf.endline_kg,
                (SELECT COUNT(*) FROM advice_followups a WHERE a.pilot_id = pf.pilot_id AND a.farmer_id = pf.farmer_id AND a.asked_at IS NOT NULL) AS asked,
                (SELECT COUNT(*) FROM advice_followups a WHERE a.pilot_id = pf.pilot_id AND a.farmer_id = pf.farmer_id AND a.answer = 'yes') AS yes,
                (SELECT COUNT(*) FROM advice_followups a WHERE a.pilot_id = pf.pilot_id AND a.farmer_id = pf.farmer_id AND a.answer = 'partly') AS partly,
                (SELECT COUNT(*) FROM advice_followups a WHERE a.pilot_id = pf.pilot_id AND a.farmer_id = pf.farmer_id AND a.answer = 'no') AS no,
                (SELECT COUNT(*) FROM chat_messages m JOIN chat_conversations cv ON cv.id = m.conversation_id
                  WHERE cv.farmer_id = pf.farmer_id AND m.role IN ('user', 'farmer')) AS messages,
                (SELECT COUNT(*) FROM visits vi
                  WHERE vi.farmer_id = pf.farmer_id AND vi.status = 'completed'
                    AND COALESCE(vi.completed_at, vi.scheduled_at) >= p.season_start
                    AND COALESCE(vi.completed_at, vi.scheduled_at) < p.season_end + INTERVAL '1 day') AS visits
           FROM pilot_farmers pf JOIN pilots p ON p.id = pf.pilot_id WHERE pf.pilot_id = $1 ORDER BY 1`,
        [pilotId],
    );
    const cell = (value: unknown) => (value === null || value === undefined ? '' : String(value));
    const header = 'farmer,group,area_ha,last_season_kg,this_season_kg,followups_asked,followed_yes,followed_partly,followed_no,messages_sent,visits_in_season';
    return [header, ...rows.map(r => [r.n, r.arm, r.area_ha, r.baseline_kg, r.endline_kg, r.asked, r.yes, r.partly, r.no, r.messages, r.visits].map(cell).join(','))].join('\n');
}
