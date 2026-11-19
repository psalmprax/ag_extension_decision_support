import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { E2E_SYSTEM_ADMIN_EMAIL, REAL_WORLD_TENANT_ID } from '../src/seed/realWorldSeed';

/**
 * A system administrator for the end-to-end tests only, so they can grant and
 * revoke service access the way the real one does.
 *
 * It is never part of a seed a server runs: it refuses any database that is not
 * on this machine, and its password comes from E2E_SYSTEM_ADMIN_PASSWORD, which
 * the test run generates fresh each time (it is never written down anywhere).
 * The account sits on the reserved fixture domain, so `seed:realworld --reset`
 * deletes it with the other fixtures.
 *
 * The one exception is the live user-story workflow (user-stories-live.yml),
 * which sets E2E_SYSTEM_ADMIN_TEMPORARY=removed-after-run: it creates the
 * account for one run and always disables it afterwards
 * (prisma/disable-e2e-system-admin.ts).
 */
export { E2E_SYSTEM_ADMIN_EMAIL };
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

async function main(): Promise<void> {
    const password = process.env.E2E_SYSTEM_ADMIN_PASSWORD ?? '';
    const connectionString = process.env.DATABASE_URL ?? '';
    if (password.length < 16) throw new Error('E2E_SYSTEM_ADMIN_PASSWORD (at least 16 characters) is required');
    const host = new URL(connectionString).hostname;
    const temporary = process.env.E2E_SYSTEM_ADMIN_TEMPORARY === 'removed-after-run';
    if (!LOCAL_HOSTS.has(host) && !temporary) {
        throw new Error(`Refusing to create a test system administrator on ${host}: local databases only`);
    }

    // A live run tags the account with its run id, so that run's delayed expiry
    // (disable-e2e-system-admin with E2E_ONLY_RUN_ID) never touches a later run's.
    const runId = (process.env.E2E_RUN_ID ?? '').replace(/[^\w-]/g, '').slice(0, 40);
    const lastName = runId ? `System Administrator (run ${runId})` : 'System Administrator';

    const client = new Client({ connectionString });
    await client.connect();
    try {
        await client.query(
            `INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, is_demo,
                                is_system_admin, email_verified, is_active, tenant_id, created_at, updated_at)
             VALUES ($1, $2, $3, 'Test', $5, 'admin', 'Global', false, true, true, true, $4, NOW(), NOW())
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', last_name = EXCLUDED.last_name,
                is_demo = false, is_system_admin = true, is_active = true, updated_at = NOW()`,
            [randomUUID(), E2E_SYSTEM_ADMIN_EMAIL, await bcrypt.hash(password, 10), REAL_WORLD_TENANT_ID, lastName]
        );
        console.log(`Test system administrator ready: ${E2E_SYSTEM_ADMIN_EMAIL}`);
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
