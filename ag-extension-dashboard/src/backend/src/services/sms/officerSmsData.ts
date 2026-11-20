/** Data for officer SMS commands: the staff member's farmers, unanswered threads and visits. */
import { query } from '@/services/databaseService';
import type { SmsStaff } from './officerSmsAccess';

export interface FarmerRef {
    ref: number;
    farmerId: string;
    name: string;
}

/** SQL condition (on alias f) for the farmers a staff member may act on by SMS. */
function scope(staff: SmsStaff, firstParam: number): { sql: string; params: unknown[] } {
    if (staff.role === 'regional_manager') {
        return { sql: `f.region = $${firstParam} AND f.tenant_id IS NOT DISTINCT FROM $${firstParam + 1}`, params: [staff.region, staff.tenant_id] };
    }
    return { sql: `f.assigned_officer_id = $${firstParam}`, params: [staff.id] };
}

/** Stable short numbers for farmers, per staff member (new farmers get the next number). */
export async function refsFor(staffId: string, farmerIds: string[]): Promise<Map<string, number>> {
    const refs = new Map<string, number>();
    if (farmerIds.length === 0) return refs;
    const { rows } = await query<{ farmer_id: string; ref: number }>(
        'SELECT farmer_id, ref FROM officer_sms_refs WHERE officer_id = $1 AND farmer_id = ANY($2::uuid[])',
        [staffId, farmerIds],
    );
    rows.forEach(row => refs.set(row.farmer_id, row.ref));
    for (const farmerId of farmerIds) {
        if (refs.has(farmerId)) continue;
        const inserted = await query<{ ref: number }>(
            `INSERT INTO officer_sms_refs (officer_id, ref, farmer_id)
             SELECT $1, COALESCE(MAX(ref), 0) + 1, $2 FROM officer_sms_refs WHERE officer_id = $1
             ON CONFLICT (officer_id, farmer_id) DO UPDATE SET farmer_id = EXCLUDED.farmer_id
             RETURNING ref`,
            [staffId, farmerId],
        );
        refs.set(farmerId, inserted.rows[0].ref);
    }
    return refs;
}

/** The farmer behind a short number, if the staff member may still act on them. */
export async function farmerForRef(staff: SmsStaff, ref: number): Promise<{ id: string; name: string; tenant_id: string | null } | null> {
    const s = scope(staff, 3);
    const { rows } = await query<{ id: string; name: string; tenant_id: string | null }>(
        `SELECT f.id, TRIM(f.first_name || ' ' || f.last_name) AS name, f.tenant_id
           FROM officer_sms_refs r JOIN farmers f ON f.id = r.farmer_id
          WHERE r.officer_id = $1 AND r.ref = $2 AND ${s.sql}`,
        [staff.id, ref, ...s.params],
    );
    return rows[0] ?? null;
}

export interface InboxItem extends FarmerRef {
    conversationId: string;
    text: string;
    hoursAgo: number;
}

/** The newest threads whose last message is the farmer's (waiting for a reply). */
export async function unansweredThreads(staff: SmsStaff, limit = 3): Promise<InboxItem[]> {
    const s = scope(staff, 2);
    const { rows } = await query<{ conversation_id: string; farmer_id: string; name: string; content: string; created_at: Date }>(
        `SELECT cv.id AS conversation_id, f.id AS farmer_id, TRIM(f.first_name || ' ' || f.last_name) AS name,
                last.content, last.created_at
           FROM chat_conversations cv
           JOIN farmers f ON f.id = cv.farmer_id
           JOIN LATERAL (
                SELECT role, content, created_at FROM chat_messages
                 WHERE conversation_id = cv.id ORDER BY created_at DESC LIMIT 1
           ) last ON last.role IN ('user', 'farmer')
          WHERE cv.kind = 'farmer_thread' AND ${s.sql}
          ORDER BY last.created_at DESC
          LIMIT $1`,
        [limit, ...s.params],
    );
    const refs = await refsFor(staff.id, rows.map(row => row.farmer_id));
    return rows.map(row => ({
        ref: refs.get(row.farmer_id)!,
        farmerId: row.farmer_id,
        name: row.name,
        conversationId: row.conversation_id,
        text: row.content,
        hoursAgo: Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000)),
    }));
}

/** Farmers whose name (or village) matches, up to five. */
export async function findFarmers(staff: SmsStaff, text: string): Promise<FarmerRef[]> {
    const s = scope(staff, 2);
    const { rows } = await query<{ id: string; name: string }>(
        `SELECT f.id, TRIM(f.first_name || ' ' || f.last_name) AS name FROM farmers f
          WHERE (f.first_name || ' ' || f.last_name || ' ' || COALESCE(f.village, '')) ILIKE $1 AND ${s.sql}
          ORDER BY f.first_name, f.last_name LIMIT 5`,
        [`%${text.replace(/[%_\\]/g, '')}%`, ...s.params],
    );
    const refs = await refsFor(staff.id, rows.map(row => row.id));
    return rows.map(row => ({ ref: refs.get(row.id)!, farmerId: row.id, name: row.name }));
}

/** The farmer's thread with their officer, for an SMS reply (created if missing). */
export async function threadForFarmer(farmerId: string): Promise<string> {
    const { farmerThreadFor } = await import('@/services/chat/channelThread');
    return farmerThreadFor(farmerId);
}

/** Record a visit reported by SMS. No position is shared, so the location check says so. */
export async function recordSmsVisit(params: {
    staffId: string;
    farmer: { id: string; tenant_id: string | null };
    status: 'completed' | 'scheduled';
    when: Date;
    notes: string;
}): Promise<string> {
    const completed = params.status === 'completed';
    const { rows } = await query<{ id: string }>(
        `INSERT INTO visits (officer_id, farmer_id, tenant_id, visit_type, status, scheduled_at, completed_at, notes, location_check)
         VALUES ($1, $2, $3, 'routine', $4, $5, $6, $7, $8) RETURNING id`,
        [params.staffId, params.farmer.id, params.farmer.tenant_id, params.status, params.when,
         completed ? params.when : null, params.notes || null, completed ? 'not_shared' : null],
    );
    return rows[0].id;
}
