import { Client } from 'pg';
import { disableE2eSystemAdmin, sanitizeRunId } from '../src/seed/e2eSystemAdmin';

/**
 * Ends a live user-story run: the temporary test system administrator loses its
 * administrator rights, its password and its sessions. The row stays so the
 * audit trail it wrote keeps its author; `seed:realworld --reset` deletes it.
 *
 * With E2E_ONLY_RUN_ID set (the delayed expiry a run leaves on the host in case
 * its own cleanup never runs), only the account tagged with that run is
 * disabled: a later run that re-created the account is left alone. The tag
 * lives in profile_settings, so renaming the account does not hide it.
 */
async function main(): Promise<void> {
    const runId = sanitizeRunId(process.env.E2E_ONLY_RUN_ID) || undefined;
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const disabled = await disableE2eSystemAdmin(client, runId);
        console.log(`Test system administrator disabled (${disabled} row).`);
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
