import { Client } from 'pg';
import { disableE2eSystemAdmin, E2E_RUN_TAG_KEY, sanitizeRunId, upsertE2eSystemAdmin } from '@/seed/e2eSystemAdmin';
import { E2E_SYSTEM_ADMIN_EMAIL } from '@/seed/realWorldSeed';

describe('sanitizeRunId', () => {
    it('keeps word characters and dashes, at most 40', () => {
        expect(sanitizeRunId('44667326794-1')).toBe('44667326794-1');
        expect(sanitizeRunId("1' OR '1'='1")).toBe('1OR11');
        expect(sanitizeRunId('x'.repeat(60))).toHaveLength(40);
        expect(sanitizeRunId(undefined)).toBe('');
    });
});

/**
 * Against a real PostgreSQL schema: creates and disables the test system
 * administrator on the reserved fixture domain in that database.
 */
const databaseUrl = process.env.E2E_ADMIN_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)('the delayed expiry of the test system administrator', () => {
    let client: Client;

    beforeAll(async () => {
        client = new Client({ connectionString: databaseUrl });
        await client.connect();
    });

    afterAll(async () => {
        await disableE2eSystemAdmin(client);
        await client.end();
    });

    const account = async () =>
        (await client.query(
            `SELECT is_active, is_system_admin, last_name, profile_settings ->> $2 AS run_tag FROM users WHERE email = $1`,
            [E2E_SYSTEM_ADMIN_EMAIL, E2E_RUN_TAG_KEY]
        )).rows[0];

    // The same statement PATCH /auth/me runs for a name and profile-settings change.
    const editProfile = (lastName: string, profileSettings: Record<string, unknown>) =>
        client.query(
            `UPDATE users SET last_name = $1,
                    profile_settings = COALESCE(profile_settings, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
              WHERE email = $3`,
            [lastName, JSON.stringify(profileSettings), E2E_SYSTEM_ADMIN_EMAIL]
        );

    it('still disables the run\'s account after its profile was edited', async () => {
        await upsertE2eSystemAdmin(client, 'hash-run-a', 'run-a');
        await editProfile('Renamed by the test', { handle: 'renamed_admin', areaUnit: 'acres' });
        expect(await account()).toMatchObject({ last_name: 'Renamed by the test', run_tag: 'run-a', is_active: true });

        expect(await disableE2eSystemAdmin(client, 'run-a')).toBe(1);
        expect(await account()).toMatchObject({ is_active: false, is_system_admin: false });
    });

    it('leaves a later run\'s account alone', async () => {
        await upsertE2eSystemAdmin(client, 'hash-run-b', 'run-b');
        expect(await disableE2eSystemAdmin(client, 'run-a')).toBe(0);
        expect(await account()).toMatchObject({ run_tag: 'run-b', is_active: true, is_system_admin: true });
    });

    it('drops the tag when a local run recreates the account without one', async () => {
        await upsertE2eSystemAdmin(client, 'hash-local', '');
        expect(await account()).toMatchObject({ run_tag: null, is_active: true });
        expect(await disableE2eSystemAdmin(client, 'run-b')).toBe(0);
    });
});
