import { getPool } from '@/services/databaseService';

const LOCK_CLASS = 1095193689;
const LOCK_ID = 1263753550;

export interface KnowledgeSyncLock {
    assertHeld(): void;
    release(): Promise<void>;
}

function requirePool() {
    const pool = getPool();
    if (!pool) throw new Error('Database unavailable for knowledge sync lock');
    return pool;
}

export async function acquireKnowledgeSyncLock(): Promise<KnowledgeSyncLock | null> {
    const client = await requirePool().connect();
    let lost: Error | undefined;
    const onError = (error: Error) => { lost = error; };
    client.on('error', onError);
    try {
        const result = await client.query<{ acquired: boolean }>(
            'SELECT pg_try_advisory_lock($1, $2) AS acquired', [LOCK_CLASS, LOCK_ID],
        );
        if (!result.rows[0]?.acquired) {
            client.removeListener('error', onError);
            client.release();
            return null;
        }
    } catch (error) {
        client.removeListener('error', onError);
        client.release(true);
        throw error;
    }

    return {
        assertHeld() {
            if (lost) throw new Error(`Knowledge sync lock connection was lost: ${lost.message}`);
        },
        async release() {
            let destroy = false;
            try {
                if (lost) throw new Error(`Knowledge sync lock connection was lost: ${lost.message}`);
                const result = await client.query<{ released: boolean }>(
                    'SELECT pg_advisory_unlock($1, $2) AS released', [LOCK_CLASS, LOCK_ID],
                );
                if (!result.rows[0]?.released) throw new Error('Knowledge sync lock was not held');
            } catch (error) {
                destroy = true;
                throw error;
            } finally {
                client.removeListener('error', onError);
                client.release(destroy);
            }
        },
    };
}

export async function isKnowledgeSyncLocked(): Promise<boolean> {
    const result = await requirePool().query<{ in_progress: boolean }>(`
        SELECT EXISTS (
            SELECT 1 FROM pg_locks
            WHERE locktype = 'advisory'
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND classid = $1::oid AND objid = $2::oid AND objsubid = 2 AND granted
        ) AS in_progress
    `, [LOCK_CLASS, LOCK_ID]);
    return result.rows[0].in_progress;
}
