/**
 * Pilots: one region, one crop, one season. Farmers are split at random into a service
 * group and a comparison group when the pilot starts, so a later difference in harvests
 * can be put down to the service rather than to who signed up.
 */
import { randomInt } from 'crypto';
import { query } from '@/services/databaseService';
import { resolvePrincipalRegion } from '@/services/messageAccessService';
import { sendFarmerNotice, type NoticeOutcome } from '@/services/notify/farmerNotices';

export class PilotError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}

export interface PilotPrincipal { userId: string; role: string }

export interface PilotInput {
    name: string;
    region: string;
    country?: string | null;
    crop: string;
    seasonStart: string;
    seasonEnd: string;
    comparisonShare?: number;
    bagKg?: number;
}

export interface PilotRow {
    id: string; name: string; region: string; country: string | null; crop: string;
    season_start: string; season_end: string; comparison_share: number; bag_kg: number;
    status: 'draft' | 'running' | 'closed'; created_at: Date;
}

/** A manager works only with pilots in their own region. */
async function regionFilter(principal: PilotPrincipal): Promise<string | null> {
    if (principal.role === 'admin') return null;
    const region = await resolvePrincipalRegion(principal.userId);
    if (!region) throw new PilotError('Your account has no region, so you cannot run pilots.', 403);
    return region;
}

export async function listPilots(principal: PilotPrincipal): Promise<PilotRow[]> {
    const region = await regionFilter(principal);
    const { rows } = await query<PilotRow>(
        `SELECT * FROM pilots WHERE ($1::text IS NULL OR region = $1) ORDER BY created_at DESC`,
        [region],
    );
    return rows;
}

export async function getPilot(principal: PilotPrincipal, id: string): Promise<PilotRow> {
    const region = await regionFilter(principal);
    const { rows } = await query<PilotRow>(`SELECT * FROM pilots WHERE id = $1 AND ($2::text IS NULL OR region = $2)`, [id, region]);
    if (!rows[0]) throw new PilotError('Pilot not found', 404);
    return rows[0];
}

export async function createPilot(principal: PilotPrincipal, input: PilotInput): Promise<PilotRow> {
    const region = await regionFilter(principal);
    if (region && region !== input.region) throw new PilotError('You can run pilots only in your own region.', 403);
    if (new Date(input.seasonEnd) <= new Date(input.seasonStart)) throw new PilotError('The season must end after it starts.');
    const { rows } = await query<PilotRow>(
        `INSERT INTO pilots (name, region, country, crop, season_start, season_end, comparison_share, bag_kg, created_by, tenant_id)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, u.tenant_id FROM users u WHERE u.id = $9
         RETURNING *`,
        [input.name, input.region, input.country ?? null, input.crop.toLowerCase(), input.seasonStart, input.seasonEnd,
         input.comparisonShare ?? 0.5, input.bagKg ?? 90, principal.userId],
    );
    return rows[0];
}

/** Shuffle (Fisher–Yates with a cryptographic source) and cut: the first share goes to comparison. */
export function assignArms<T>(items: T[], comparisonShare: number, pick: (max: number) => number = randomInt): Array<{ item: T; arm: 'service' | 'comparison' }> {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = pick(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const comparison = Math.round(shuffled.length * comparisonShare);
    return shuffled.map((item, index) => ({ item, arm: index < comparison ? 'comparison' : 'service' }));
}

/** Enrol every real farmer in the region (not yet in this pilot), split at random, and start the pilot. */
export async function startPilot(principal: PilotPrincipal, id: string): Promise<{ service: number; comparison: number }> {
    const pilot = await getPilot(principal, id);
    if (pilot.status !== 'draft') throw new PilotError('This pilot has already started.', 409);
    const { rows } = await query<{ id: string; farm_size_hectares: number | null }>(
        `SELECT f.id, f.farm_size_hectares FROM farmers f
          WHERE f.region = $1 AND ($2::text IS NULL OR f.country = $2) AND COALESCE(f.is_demo, false) = false
            AND COALESCE(f.is_active, true) = true`,
        [pilot.region, pilot.country],
    );
    if (rows.length < 2) throw new PilotError('A pilot needs at least two farmers in the region.');
    const arms = assignArms(rows, pilot.comparison_share);
    for (const { item, arm } of arms) {
        await query(
            `INSERT INTO pilot_farmers (pilot_id, farmer_id, arm, area_ha) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [id, item.id, arm, item.farm_size_hectares],
        );
    }
    await query(`UPDATE pilots SET status = 'running' WHERE id = $1`, [id]);
    const comparison = arms.filter(a => a.arm === 'comparison').length;
    return { service: arms.length - comparison, comparison };
}

export async function closePilot(principal: PilotPrincipal, id: string): Promise<void> {
    await getPilot(principal, id);
    await query(`UPDATE pilots SET status = 'closed' WHERE id = $1`, [id]);
}

/** Ask every pilot farmer (both groups) for last season's or this season's harvest. */
export async function askHarvest(principal: PilotPrincipal, id: string, which: 'baseline' | 'endline'): Promise<Record<NoticeOutcome, number>> {
    const pilot = await getPilot(principal, id);
    if (pilot.status !== 'running') throw new PilotError('Start the pilot first.', 409);
    const { rows } = await query<{ farmer_id: string }>('SELECT farmer_id FROM pilot_farmers WHERE pilot_id = $1', [id]);
    const counts: Record<NoticeOutcome, number> = { sent: 0, opted_out: 0, no_contact: 0, failed: 0 };
    for (const { farmer_id } of rows) {
        counts[await sendFarmerNotice(farmer_id, which === 'baseline' ? 'harvest_baseline' : 'harvest_endline', { crop: pilot.crop })] += 1;
    }
    return counts;
}
