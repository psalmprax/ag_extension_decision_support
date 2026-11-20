import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { E2E_SYSTEM_ADMIN_EMAIL, REAL_WORLD_TENANT_ID } from './realWorldSeed';

/**
 * Key under users.profile_settings that tags the temporary test system
 * administrator with the live run that created it. No route can change it:
 * PATCH /auth/me validates profileSettings with a strict schema (unknown keys
 * are rejected) and merges rather than replaces, and no other route writes
 * profile_settings. The name, which the user can edit, is not used for this.
 */
export const E2E_RUN_TAG_KEY = 'e2eRunId';

/** Keeps a run id to word characters and dashes, at most 40 long. */
export function sanitizeRunId(raw: string | undefined): string {
    return (raw ?? '').replace(/[^\w-]/g, '').slice(0, 40);
}

/**
 * Creates or refreshes the test system administrator. With a run id the
 * account carries that run's tag; without one (a local run) any old tag is
 * removed.
 */
export async function upsertE2eSystemAdmin(client: Client, passwordHash: string, runId: string): Promise<void> {
    await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, is_demo,
                            is_system_admin, email_verified, is_active, tenant_id, profile_settings, created_at, updated_at)
         VALUES ($1, $2, $3, 'Test', 'System Administrator', 'admin', 'Global', false, true, true, true, $4,
                 CASE WHEN $5 = '' THEN '{}'::jsonb ELSE jsonb_build_object($6::text, $5::text) END, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin',
            last_name = EXCLUDED.last_name, is_demo = false, is_system_admin = true, is_active = true,
            profile_settings = CASE WHEN $5 = ''
                THEN COALESCE(users.profile_settings, '{}'::jsonb) - $6::text
                ELSE COALESCE(users.profile_settings, '{}'::jsonb) || jsonb_build_object($6::text, $5::text) END,
            updated_at = NOW()`,
        [randomUUID(), E2E_SYSTEM_ADMIN_EMAIL, passwordHash, REAL_WORLD_TENANT_ID, runId, E2E_RUN_TAG_KEY]
    );
}

/**
 * Takes away the test administrator's rights, password and sessions. With a
 * run id only the account tagged with that run is touched, so a run's delayed
 * expiry never disables a later run's account. Returns the rows disabled.
 */
export async function disableE2eSystemAdmin(client: Client, runId?: string): Promise<number> {
    const scope = runId ? ` AND profile_settings ->> '${E2E_RUN_TAG_KEY}' = $2` : '';
    const params = runId ? [E2E_SYSTEM_ADMIN_EMAIL, runId] : [E2E_SYSTEM_ADMIN_EMAIL];
    await client.query(`DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1${scope})`, params);
    const result = await client.query(
        `UPDATE users SET is_active = false, is_system_admin = false,
                password_hash = 'disabled-after-user-stories', updated_at = NOW()
         WHERE email = $1${scope}`,
        params
    );
    return result.rowCount ?? 0;
}
