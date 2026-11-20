import type { Client } from 'pg';
import { REAL_WORLD_EMAIL_DOMAIN, REAL_WORLD_TENANT_ID } from './realWorldSeed';

const RW_USERS = '(SELECT id FROM rw_users)';
const RW_FARMERS = '(SELECT id FROM rw_farmers)';
/**
 * A row belongs to the fixtures when its farmer is a fixture farmer, or when it
 * has no farmer and its author is a fixture account (an officer's private AI
 * chat, a visit with no farmer). A real farmer's record survives even when a
 * fixture officer wrote it: the officer reference is cleared instead.
 * AND binds tighter than OR, so no parentheses are needed (and the column
 * check in referencedColumns sees every column).
 */
const fixtureOwned = (authorColumn: string) =>
    `farmer_id IN ${RW_FARMERS} OR farmer_id IS NULL AND ${authorColumn} IN ${RW_USERS}`;

/**
 * Rows that reference a fixture user or farmer and would block, or be orphaned
 * by, deleting them. Order matters: children before parents. Tables or columns
 * missing from an older schema are skipped. A `set` entry updates instead of
 * deleting: it clears a fixture officer from a real farmer's surviving rows.
 *
 * Only references the schema cannot clear are deleted outright: a video
 * consultation needs its officer and room, an assignment-history row needs
 * whoever made the change, and an attachment cannot outlive the fixture
 * account's upload it points at.
 */
const DEPENDENT_DELETES: Array<{ table: string; where: string; set?: string }> = [
    { table: 'chat_messages', where: `conversation_id IN (SELECT id FROM chat_conversations WHERE ${fixtureOwned('officer_id')})` },
    { table: 'chat_conversations', where: fixtureOwned('officer_id') },
    { table: 'chat_conversations', where: `officer_id IN ${RW_USERS}`, set: 'officer_id = NULL' },
    { table: 'visit_attachments', where: `visit_id IN (SELECT id FROM visits WHERE ${fixtureOwned('officer_id')})
        OR upload_id IN (SELECT id FROM upload_records WHERE owner_user_id IN ${RW_USERS} OR farmer_id IN ${RW_FARMERS})` },
    { table: 'recommendation_outcomes', where: fixtureOwned('officer_id') },
    { table: 'recommendation_outcomes', where: `officer_id IN ${RW_USERS}`, set: 'officer_id = NULL' },
    { table: 'visits', where: fixtureOwned('officer_id') },
    { table: 'visits', where: `officer_id IN ${RW_USERS}`, set: 'officer_id = NULL' },
    { table: 'farmer_progress_entries', where: `farmer_id IN ${RW_FARMERS}` },
    { table: 'farmer_progress_entries', where: `officer_id IN ${RW_USERS}`, set: 'officer_id = NULL' },
    { table: 'advisory_preferences', where: `farmer_id IN ${RW_FARMERS}` },
    { table: 'video_consultations', where: `farmer_id IN ${RW_FARMERS} OR extension_officer_id IN ${RW_USERS}
        OR room_id IN (SELECT id FROM webrtc_rooms WHERE host_id IN ${RW_USERS})` },
    { table: 'notifications', where: `user_id IN ${RW_USERS} OR farmer_id IN ${RW_FARMERS}` },
    { table: 'farmer_assignment_history', where: `farmer_id IN ${RW_FARMERS} OR reassigned_by IN ${RW_USERS}` },
    { table: 'farmer_assignment_history', where: `officer_id IN ${RW_USERS}`, set: 'officer_id = NULL' },
    { table: 'diagnosis_events', where: fixtureOwned('user_id') },
    { table: 'diagnosis_events', where: `user_id IN ${RW_USERS}`, set: 'user_id = NULL' },
    { table: 'upload_records', where: `owner_user_id IN ${RW_USERS} OR farmer_id IN ${RW_FARMERS}` },
    { table: 'farmers', where: `id IN ${RW_FARMERS}` },
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
 * end-to-end runs registered), and the rows that belong to them. Accounts and
 * farmers are selected by the reserved email domain and the fixture tenant
 * only, so demo and real customer records are never chosen for deletion.
 *
 * A real farmer's own records are kept even when a fixture officer touched
 * them: assignment, conversations and their messages, visits, outcomes,
 * progress entries and diagnoses survive with the officer cleared. The only
 * real-farmer rows removed are those the schema ties to a fixture account
 * (see DEPENDENT_DELETES): video consultations with a fixture officer,
 * assignment changes a fixture account made, and attachments whose files a
 * fixture account uploaded.
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
        for (const { table, where, set } of DEPENDENT_DELETES) {
            const columns = await columnsOf(client, table);
            if (columns.size === 0) continue;
            const needed = [...referencedColumns(where), ...(set ? [set.split('=')[0].trim()] : [])];
            if (!needed.every(column => column === 'id' || columns.has(column))) continue;
            await client.query(set ? `UPDATE ${table} SET ${set} WHERE ${where}` : `DELETE FROM ${table} WHERE ${where}`);
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
