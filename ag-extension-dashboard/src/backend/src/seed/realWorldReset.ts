import type { Client } from 'pg';
import { REAL_WORLD_EMAIL_DOMAIN, REAL_WORLD_TENANT_ID } from './realWorldSeed';

/**
 * Rows that reference a fixture user or farmer and would block, or be orphaned
 * by, deleting them. Order matters: children before parents. Tables or columns
 * missing from an older schema are skipped.
 */
const DEPENDENT_DELETES: Array<{ table: string; where: string }> = [
    { table: 'chat_messages', where: `conversation_id IN (SELECT id FROM chat_conversations
        WHERE farmer_id IN (SELECT id FROM rw_farmers) OR officer_id IN (SELECT id FROM rw_users))` },
    { table: 'chat_conversations', where: 'farmer_id IN (SELECT id FROM rw_farmers) OR officer_id IN (SELECT id FROM rw_users)' },
    { table: 'visit_attachments', where: `visit_id IN (SELECT id FROM visits
        WHERE farmer_id IN (SELECT id FROM rw_farmers) OR officer_id IN (SELECT id FROM rw_users))` },
    { table: 'recommendation_outcomes', where: 'farmer_id IN (SELECT id FROM rw_farmers) OR officer_id IN (SELECT id FROM rw_users)' },
    { table: 'visits', where: 'farmer_id IN (SELECT id FROM rw_farmers) OR officer_id IN (SELECT id FROM rw_users)' },
    { table: 'farmer_progress_entries', where: 'farmer_id IN (SELECT id FROM rw_farmers) OR officer_id IN (SELECT id FROM rw_users)' },
    { table: 'advisory_preferences', where: 'farmer_id IN (SELECT id FROM rw_farmers)' },
    { table: 'video_consultations', where: 'farmer_id IN (SELECT id FROM rw_farmers) OR extension_officer_id IN (SELECT id FROM rw_users)' },
    { table: 'notifications', where: 'user_id IN (SELECT id FROM rw_users) OR farmer_id IN (SELECT id FROM rw_farmers)' },
    { table: 'farmer_assignment_history', where: 'farmer_id IN (SELECT id FROM rw_farmers) OR reassigned_by IN (SELECT id FROM rw_users)' },
    { table: 'diagnosis_events', where: 'user_id IN (SELECT id FROM rw_users) OR farmer_id IN (SELECT id FROM rw_farmers)' },
    { table: 'upload_records', where: 'owner_user_id IN (SELECT id FROM rw_users) OR farmer_id IN (SELECT id FROM rw_farmers)' },
    { table: 'farmers', where: 'id IN (SELECT id FROM rw_farmers)' },
    { table: 'usage', where: 'subscription_id IN (SELECT id FROM subscriptions WHERE user_id IN (SELECT id FROM rw_users))' },
    { table: 'subscription_change_events', where: 'subscription_id IN (SELECT id FROM subscriptions WHERE user_id IN (SELECT id FROM rw_users))' },
    { table: 'payments', where: 'subscription_id IN (SELECT id FROM subscriptions WHERE user_id IN (SELECT id FROM rw_users))' },
    { table: 'cancellation_feedback', where: 'user_id IN (SELECT id FROM rw_users)' },
    { table: 'subscriptions', where: 'user_id IN (SELECT id FROM rw_users)' },
    { table: 'knowledge_searches', where: 'user_id IN (SELECT id FROM rw_users)' },
    { table: 'push_subscriptions', where: 'user_id IN (SELECT id FROM rw_users)' },
    { table: 'scheduled_sms', where: 'user_id IN (SELECT id FROM rw_users)' },
    { table: 'transaction_submissions', where: 'user_id IN (SELECT id FROM rw_users)' },
    { table: 'webrtc_rooms', where: 'host_id IN (SELECT id FROM rw_users)' },
    { table: 'data_consents', where: 'recorded_by IN (SELECT id FROM rw_users)' },
    { table: 'data_export_requests', where: 'requested_by IN (SELECT id FROM rw_users)' },
    { table: 'recommendation_reviews', where: 'created_by IN (SELECT id FROM rw_users)' },
    { table: 'users', where: 'id IN (SELECT id FROM rw_users)' },
];

async function columnsOf(client: Client, table: string): Promise<Set<string>> {
    const { rows } = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    return new Set(rows.map(row => row.column_name));
}

/**
 * The table's own columns a WHERE clause tests, e.g. `farmer_id` and
 * `officer_id` in `farmer_id IN (...) OR officer_id IN (...)`. Subqueries are
 * removed first: their columns belong to other tables.
 */
function referencedColumns(where: string): string[] {
    let outer = where;
    for (let previous = ''; previous !== outer;) {
        previous = outer;
        outer = outer.replace(/\([^()]*\)/g, '');
    }
    return Array.from(outer.matchAll(/(\w+)\s+IN\b/g), match => match[1]);
}

/**
 * Deletes every fixture account on the reserved domain, every farmer record in
 * the fixture tenant or owned by a fixture account (including farmers that
 * end-to-end runs registered), and everything that references them. Demo and
 * real customer data are never matched: the selection is by the reserved email
 * domain and the fixture tenant only. A real farmer who was assigned to a
 * fixture officer is kept; the foreign key clears that assignment.
 */
export async function resetRealWorldFixtures(client: Client): Promise<void> {
    await client.query('BEGIN');
    try {
        await client.query(
            `CREATE TEMP TABLE rw_users ON COMMIT DROP AS SELECT id FROM users WHERE email LIKE $1`,
            [`%${REAL_WORLD_EMAIL_DOMAIN}`]
        );
        await client.query(
            `CREATE TEMP TABLE rw_farmers ON COMMIT DROP AS
             SELECT id FROM farmers
              WHERE tenant_id = $1
                 OR user_id IN (SELECT id FROM rw_users)`,
            [REAL_WORLD_TENANT_ID]
        );
        for (const { table, where } of DEPENDENT_DELETES) {
            const columns = await columnsOf(client, table);
            if (columns.size === 0) continue;
            if (!referencedColumns(where).every(column => column === 'id' || columns.has(column))) continue;
            await client.query(`DELETE FROM ${table} WHERE ${where}`);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

/**
 * True when fixtures from before the ids were RFC-valid are still present.
 * Users are upserted by email and keep their id, so those rows must be
 * replaced rather than updated.
 */
export async function hasLegacyFixtureIds(client: Client): Promise<boolean> {
    const { rows } = await client.query<{ legacy: boolean }>(
        `SELECT EXISTS (
            SELECT 1 FROM users
             WHERE email LIKE $1
               AND id::text ~ '^e[0-4]000000-0000-0000-0000-'
         ) AS legacy`,
        [`%${REAL_WORLD_EMAIL_DOMAIN}`]
    );
    return rows[0]?.legacy === true;
}
