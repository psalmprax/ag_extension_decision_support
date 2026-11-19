import { Client } from 'pg';
import { E2E_SYSTEM_ADMIN_EMAIL } from '../src/seed/realWorldSeed';

/**
 * Ends a live user-story run: the temporary test system administrator loses its
 * administrator rights, its password and its sessions. The row stays so the
 * audit trail it wrote keeps its author; `seed:realworld --reset` deletes it.
 */
async function main(): Promise<void> {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query(
            `DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [E2E_SYSTEM_ADMIN_EMAIL]
        );
        const result = await client.query(
            `UPDATE users SET is_active = false, is_system_admin = false,
                    password_hash = 'disabled-after-user-stories', updated_at = NOW()
             WHERE email = $1`, [E2E_SYSTEM_ADMIN_EMAIL]
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
