import { Pool } from 'pg';
import { getPool } from '@/services/databaseService';
import { acquireKnowledgeSyncLock, isKnowledgeSyncLocked } from '@/services/data/knowledgeSyncLock';

jest.mock('@/services/databaseService', () => ({ getPool: jest.fn() }));

const databaseUrl = process.env.KNOWLEDGE_LOCK_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)('knowledge sync PostgreSQL lock', () => {
    let firstPool: Pool;
    let secondPool: Pool;

    beforeAll(() => {
        firstPool = new Pool({ connectionString: databaseUrl });
        secondPool = new Pool({ connectionString: databaseUrl });
    });

    afterAll(async () => {
        await firstPool.end();
        await secondPool.end();
    });

    it('prevents another backend pool from acquiring the lock until release', async () => {
        jest.mocked(getPool).mockReturnValue(firstPool);
        const first = await acquireKnowledgeSyncLock();
        expect(first).not.toBeNull();
        try {
            jest.mocked(getPool).mockReturnValue(secondPool);
            expect(await isKnowledgeSyncLocked()).toBe(true);
            expect(await acquireKnowledgeSyncLock()).toBeNull();
        } finally {
            await first!.release();
        }
        expect(await isKnowledgeSyncLocked()).toBe(false);
        const second = await acquireKnowledgeSyncLock();
        expect(second).not.toBeNull();
        await second!.release();
    });

    it('detects a lost lock connection and lets another instance acquire the released lock', async () => {
        jest.mocked(getPool).mockReturnValue(firstPool);
        const first = await acquireKnowledgeSyncLock();
        expect(first).not.toBeNull();
        const holders = await secondPool.query<{ pid: number }>(`
            SELECT pid FROM pg_locks
            WHERE locktype = 'advisory' AND granted
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
        `);
        expect(holders.rows).toHaveLength(1);
        await secondPool.query('SELECT pg_terminate_backend($1)', [holders.rows[0].pid]);

        let lost = false;
        for (let attempt = 0; attempt < 50 && !lost; attempt++) {
            try {
                first!.assertHeld();
                await new Promise(resolve => setTimeout(resolve, 20));
            } catch {
                lost = true;
            }
        }
        expect(lost).toBe(true);
        await expect(first!.release()).rejects.toThrow('lock connection was lost');
        jest.mocked(getPool).mockReturnValue(secondPool);
        const second = await acquireKnowledgeSyncLock();
        expect(second).not.toBeNull();
        await second!.release();
    });
});
