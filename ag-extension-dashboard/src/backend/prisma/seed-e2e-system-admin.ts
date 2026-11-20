import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { E2E_SYSTEM_ADMIN_EMAIL } from '../src/seed/realWorldSeed';
import { sanitizeRunId, upsertE2eSystemAdmin } from '../src/seed/e2eSystemAdmin';

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

    // A live run tags the account with its run id (in profile_settings, which no
    // route lets a user change), so that run's delayed expiry
    // (disable-e2e-system-admin with E2E_ONLY_RUN_ID) never touches a later run's.
    const runId = sanitizeRunId(process.env.E2E_RUN_ID);

    const client = new Client({ connectionString });
    await client.connect();
    try {
        await upsertE2eSystemAdmin(client, await bcrypt.hash(password, 10), runId);
        console.log(`Test system administrator ready: ${E2E_SYSTEM_ADMIN_EMAIL}`);
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
