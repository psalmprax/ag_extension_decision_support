/**
 * What pilot farmers send back: their harvest (YIELD 900, YIELD 10 BAGS) and whether they
 * followed their officer's advice (YES, PARTLY, NO in their language). A YES/NO counts only
 * when a follow-up question is waiting, so an ordinary "no" to the officer is left alone.
 */
import { query } from '@/services/databaseService';
import { sendFarmerNotice } from '@/services/notify/farmerNotices';

const YIELD = /^\s*(?:yield|mavuno|recolte|récolte|colheita)\s+([\d.,]+)\s*(kg|kgs|kilo|kilos|bags?|sacks?|magunia|gunia|sacs?|sacos?)?\s*$/i;
const ANSWERS: Record<string, 'yes' | 'partly' | 'no'> = {
    yes: 'yes', ndio: 'yes', ndiyo: 'yes', oui: 'yes', sim: 'yes',
    partly: 'partly', kiasi: 'partly', 'en partie': 'partly', 'em parte': 'partly',
    no: 'no', hapana: 'no', non: 'no', nao: 'no', 'não': 'no',
};
const WAIT_DAYS = 3;

export function parseYield(text: string, bagKg: number): number | null {
    const match = YIELD.exec(text);
    if (!match) return null;
    const amount = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return null;
    const unit = (match[2] ?? 'kg').toLowerCase();
    return Math.round((unit.startsWith('k') ? amount : amount * bagKg) * 10) / 10;
}

export function parseAnswer(text: string): 'yes' | 'partly' | 'no' | null {
    return ANSWERS[text.trim().toLowerCase().replace(/[.!]+$/, '')] ?? null;
}

/** Looks like a pilot reply at all (cheap check before any lookup). */
export function mayBePilotReply(text: string): boolean {
    return /^\s*(?:yield|mavuno|recolte|récolte|colheita)\b/i.test(text) || parseAnswer(text) !== null;
}

/** Record that an inbound SMS was checked as a pilot reply; false when it already was (a retry). */
export async function claimPilotEvent(phone: string, eventId: string): Promise<boolean> {
    const { rows } = await query<{ event_id: string }>(
        `INSERT INTO messaging_inbound_events (channel, external_identifier, event_id) VALUES ('pilot', $1, $2)
         ON CONFLICT (channel, external_identifier, event_id) DO NOTHING RETURNING event_id`,
        [phone, eventId],
    );
    return rows.length > 0;
}

/** The farmer's running pilot (the newest, if more than one). */
async function runningPilotOf(farmerId: string) {
    const { rows } = await query<{ pilot_id: string; season_end: string; bag_kg: number }>(
        `SELECT p.id AS pilot_id, p.season_end, p.bag_kg
           FROM pilot_farmers pf JOIN pilots p ON p.id = pf.pilot_id
          WHERE pf.farmer_id = $1 AND p.status = 'running'
          ORDER BY p.created_at DESC LIMIT 1`,
        [farmerId],
    );
    return rows[0] ?? null;
}

/** Record the reply if it is one; true when handled (the farmer has been answered). */
export async function takePilotReply(farmerId: string, text: string, now = new Date()): Promise<boolean> {
    if (!mayBePilotReply(text)) return false;
    const pilot = await runningPilotOf(farmerId);
    if (!pilot) return false;

    if (/^\s*(?:yield|mavuno|recolte|récolte|colheita)\b/i.test(text)) {
        const kg = parseYield(text, pilot.bag_kg);
        if (kg === null) {
            await sendFarmerNotice(farmerId, 'harvest_usage', {}, { always: true });
            return true;
        }
        // Before the season ends it is last season's harvest; after, this season's.
        const column = now < new Date(pilot.season_end) ? 'baseline_kg' : 'endline_kg';
        await query(`UPDATE pilot_farmers SET ${column} = $3 WHERE pilot_id = $1 AND farmer_id = $2`, [pilot.pilot_id, farmerId, kg]);
        await sendFarmerNotice(farmerId, 'harvest_thanks', { kg: String(kg) }, { always: true });
        return true;
    }

    const answer = parseAnswer(text);
    const { rows } = await query<{ id: string }>(
        `UPDATE advice_followups SET answer = $2, answered_at = NOW()
          WHERE id = (SELECT id FROM advice_followups
                       WHERE farmer_id = $1 AND asked_at IS NOT NULL AND answered_at IS NULL
                         AND asked_at > NOW() - make_interval(days => $3)
                       ORDER BY asked_at DESC LIMIT 1)
          RETURNING id`,
        [farmerId, answer, WAIT_DAYS],
    );
    if (!rows[0]) return false;
    await sendFarmerNotice(farmerId, 'followup_thanks', {}, { always: true });
    return true;
}
