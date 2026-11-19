import { Client } from 'pg';
import { E2E_SYSTEM_ADMIN_EMAIL } from '../src/seed/realWorldSeed';

/**
 * Ends a live user-story run: the temporary test system administrator loses its
 * administrator rights, its password and its sessions. The row stays so the
 * audit trail it wrote keeps its author; `seed:realworld --reset` deletes it.
 *
 * With E2E_ONLY_RUN_ID set (the delayed expiry a run leaves on the host in case
 * its own cleanup never runs), only that run's account is disabled: a later
 * run that re-created the account is left alone.
 */
async function main(): Promise<void> {
    const runId = process.env.E2E_ONLY_RUN_ID;
    const scope = runId ? ` AND last_name = 'System Administrator (run ' || $2 || ')'` : '';
    const params = runId ? [E2E_SYSTEM_ADMIN_EMAIL, runId] : [E2E_SYSTEM_ADMIN_EMAIL];
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query(
            `DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1${scope})`, params
        );
        const result = await client.query(
            `UPDATE users SET is_active = false, is_system_admin = false,
                    password_hash = 'disabled-after-user-stories', updated_at = NOW()
             WHERE email = $1${scope}`, params
        );
        console.log(`Test system administrator disabled (${result.rowCount ?? 0} row).`);
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
