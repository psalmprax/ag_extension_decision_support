import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { resetRealWorldFixtures } from '@/seed/realWorldReset';
import { REAL_WORLD_EMAIL_DOMAIN } from '@/seed/realWorldSeed';

/**
 * Runs the fixture reset against a real PostgreSQL schema. The reset removes
 * every fixture account in that database, so point
 * REAL_WORLD_RESET_TEST_DATABASE_URL at a disposable one (and re-run
 * `seed:realworld` afterwards if it held the test population).
 */
const databaseUrl = process.env.REAL_WORLD_RESET_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)('real-world fixture reset keeps real farmers\' records', () => {
    let client: Client;
    const ids = {
        realOfficer: randomUUID(),
        fixtureOfficer: randomUUID(),
        realFarmer: randomUUID(),
        sharedThread: randomUUID(),
        sharedMessage: randomUUID(),
        privateAiChat: randomUUID(),
        sharedVisit: randomUUID(),
        fixtureRoom: randomUUID(),
        consultationInFixtureRoom: randomUUID(),
    };

    beforeAll(async () => {
        client = new Client({ connectionString: databaseUrl });
        await client.connect();
        const user = (id: string, email: string) =>
            client.query(
                `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
                 VALUES ($1, $2, 'x', 'Reset', 'Test', 'extension_officer')`,
                [id, email]
            );
        await user(ids.realOfficer, `reset-real-${ids.realOfficer}@example.org`);
        await user(ids.fixtureOfficer, `reset-fixture-${ids.fixtureOfficer}${REAL_WORLD_EMAIL_DOMAIN}`);
        await client.query(
            `INSERT INTO farmers (id, first_name, last_name, assigned_officer_id) VALUES ($1, 'Real', 'Farmer', $2)`,
            [ids.realFarmer, ids.fixtureOfficer]
        );
        await client.query(
            `INSERT INTO chat_conversations (id, farmer_id, officer_id) VALUES ($1, $2, $3)`,
            [ids.sharedThread, ids.realFarmer, ids.fixtureOfficer]
        );
        await client.query(
            `INSERT INTO chat_messages (id, conversation_id, role, content) VALUES ($1, $2, 'user', 'Leaves are yellowing')`,
            [ids.sharedMessage, ids.sharedThread]
        );
        await client.query(
            `INSERT INTO chat_conversations (id, farmer_id, officer_id, kind) VALUES ($1, NULL, $2, 'officer_ai')`,
            [ids.privateAiChat, ids.fixtureOfficer]
        );
        await client.query(
            `INSERT INTO visits (id, farmer_id, officer_id) VALUES ($1, $2, $3)`,
            [ids.sharedVisit, ids.realFarmer, ids.fixtureOfficer]
        );
        // A real officer's consultation that happens to use a room a fixture account hosted.
        await client.query(`INSERT INTO webrtc_rooms (id, host_id) VALUES ($1, $2)`, [ids.fixtureRoom, ids.fixtureOfficer]);
        await client.query(
            `INSERT INTO video_consultations (id, farmer_id, extension_officer_id, scheduled_time, room_id)
             VALUES ($1, $2, $3, NOW(), $4)`,
            [ids.consultationInFixtureRoom, ids.realFarmer, ids.realOfficer, ids.fixtureRoom]
        );

        await resetRealWorldFixtures(client);
    });

    afterAll(async () => {
        await client.query('DELETE FROM chat_messages WHERE id = $1', [ids.sharedMessage]);
        await client.query('DELETE FROM chat_conversations WHERE id = ANY($1)', [[ids.sharedThread, ids.privateAiChat]]);
        await client.query('DELETE FROM visits WHERE id = $1', [ids.sharedVisit]);
        await client.query('DELETE FROM video_consultations WHERE id = $1', [ids.consultationInFixtureRoom]);
        await client.query('DELETE FROM farmers WHERE id = $1', [ids.realFarmer]);
        await client.query('DELETE FROM users WHERE id = $1', [ids.realOfficer]);
        await client.end();
    });

    const one = async (sql: string, params: unknown[]) => (await client.query(sql, params)).rows[0];

    it('removes the fixture officer', async () => {
        expect(await one('SELECT id FROM users WHERE id = $1', [ids.fixtureOfficer])).toBeUndefined();
    });

    it('keeps the real farmer, with the fixture assignment cleared', async () => {
        expect(await one('SELECT assigned_officer_id FROM farmers WHERE id = $1', [ids.realFarmer]))
            .toEqual({ assigned_officer_id: null });
    });

    it('keeps the real farmer\'s conversation and its messages, with the officer cleared', async () => {
        expect(await one('SELECT officer_id FROM chat_conversations WHERE id = $1', [ids.sharedThread]))
            .toEqual({ officer_id: null });
        expect(await one('SELECT content FROM chat_messages WHERE id = $1', [ids.sharedMessage]))
            .toEqual({ content: 'Leaves are yellowing' });
    });

    it('deletes the fixture officer\'s private AI chat, which has no farmer', async () => {
        expect(await one('SELECT id FROM chat_conversations WHERE id = $1', [ids.privateAiChat])).toBeUndefined();
    });

    it('keeps the real farmer\'s visit, with the officer cleared', async () => {
        expect(await one('SELECT officer_id FROM visits WHERE id = $1', [ids.sharedVisit])).toEqual({ officer_id: null });
    });

    it('removes a consultation in a room a fixture account hosted, so the room can go', async () => {
        expect(await one('SELECT id FROM video_consultations WHERE id = $1', [ids.consultationInFixtureRoom])).toBeUndefined();
        expect(await one('SELECT id FROM webrtc_rooms WHERE id = $1', [ids.fixtureRoom])).toBeUndefined();
    });
});
