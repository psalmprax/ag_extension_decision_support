import type { PoolClient } from 'pg';
import { query, withTransaction } from '@/services/databaseService';

/**
 * Tamper-evident audit log. Every entry stores its position in the chain, the hash of the entry
 * before it and its own hash, so an entry that is later changed, or removed from the middle or
 * the start of the chain, shows up when the chain is checked. Someone able to rewrite the whole
 * table could recompute every hash, which is why the newest hash is shown to administrators to
 * note down somewhere else: a later chain that does not contain it has been rewritten or cut short.
 */

/** Audit writes take turns on this lock, so each new entry links to the one written before it. */
const AUDIT_CHAIN_LOCK = 727_011_001;

/**
 * SHA-256 over an entry's stored fields and the previous entry's hash, as a JSON array that
 * Postgres prints the same way every time. Writing and checking both use this expression, so
 * they can never disagree on what an unchanged entry hashes to.
 */
export function entryHashSql(alias: string): string {
    // actor_key, not actor_id: deleting an account sets actor_id to NULL, which is not tampering.
    const columns = ['chain_seq', 'prev_hash', 'actor_key', 'actor_role', 'action', 'method', 'path', 'resource_type', 'resource_id', 'status_code', 'ip_address', 'user_agent', 'request_body', 'created_at'];
    return `encode(sha256(convert_to(jsonb_build_array(${columns.map(c => `${alias}.${c}`).join(', ')})::text, 'UTF8')), 'hex')`;
}

/** Values in the order of the INSERT below. */
export type AuditRowValues = [
    actorId: string | null,
    actorRole: string | null,
    action: string,
    method: string,
    path: string,
    resourceType: string | null,
    resourceId: string | null,
    statusCode: number,
    ipAddress: string | null,
    userAgent: string | null,
    requestBody: string | null,
];

/** Appends one entry to the end of the chain, in one transaction. */
export async function appendChainedAuditEntry(values: AuditRowValues): Promise<void> {
    await withTransaction(async (client: PoolClient) => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [AUDIT_CHAIN_LOCK]);
        const head = await client.query<{ chain_seq: string; entry_hash: string }>(
            'SELECT chain_seq, entry_hash FROM audit_logs WHERE chain_seq IS NOT NULL ORDER BY chain_seq DESC LIMIT 1'
        );
        const previous = head.rows[0];
        const seq = previous ? (BigInt(previous.chain_seq) + 1n).toString() : '1';
        const inserted = await client.query<{ id: string }>(
            `INSERT INTO audit_logs
               (actor_id, actor_key, actor_role, action, method, path, resource_type, resource_id, status_code, ip_address, user_agent,
                request_body, created_at, chain_seq, prev_hash)
             VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)
             RETURNING id`,
            [...values, seq, previous?.entry_hash ?? null]
        );
        await client.query(`UPDATE audit_logs a SET entry_hash = ${entryHashSql('a')} WHERE a.id = $1`, [inserted.rows[0].id]);
    });
}

export type ChainProblem = 'changed' | 'missing';

export interface ChainCheck {
    /** intact: every chained entry checks out. broken: see `problem`. empty: nothing chained yet. */
    status: 'intact' | 'broken' | 'empty';
    checkedEntries: number;
    /** Entries written before the chain began; they carry no hash and cannot be checked. */
    unchainedEntries: number;
    firstChainedAt: string | null;
    head: { seq: number; hash: string; at: string } | null;
    /** The first entry where the chain breaks: its content changed, or entries before it are gone. */
    problem: { seq: number; kind: ChainProblem; at: string } | null;
    /**
     * Entries whose account was deleted before 3 December 2026: the hash then covered the account
     * link, which deletion clears, so their content can no longer be checked. Their links still are.
     */
    unverifiableEntries: number;
}

interface ChainRow {
    chain_seq: string;
    entry_hash: string | null;
    created_at: Date;
    hash_ok: boolean;
    link_ok: boolean;
    gap: boolean;
}

/**
 * An entry whose account was deleted before actor_key existed: the migration that added it listed
 * every entry that had already stopped matching its hash with no account named. Only those
 * qualify, so an entry that stops matching later is reported as changed.
 */
const ACTOR_LOST_SQL = `(a.actor_key IS NULL AND a.chain_seq = ANY(COALESCE(
    (SELECT string_to_array(NULLIF(value, ''), ',')::bigint[] FROM audit_chain_meta WHERE key = 'actor_lost_seqs'), '{}')))`;

/** Walks the whole chain in order and reports the first break, if any. */
export async function checkAuditChain(): Promise<ChainCheck> {
    const [{ rows }, counts] = await Promise.all([
        query<ChainRow>(
            `WITH chained AS (
                SELECT a.chain_seq, a.prev_hash, a.entry_hash, a.created_at,
                       ${entryHashSql('a')} AS recomputed,
                       LAG(a.entry_hash) OVER (ORDER BY a.chain_seq) AS previous_hash,
                       LAG(a.chain_seq) OVER (ORDER BY a.chain_seq) AS previous_seq,
                       ${ACTOR_LOST_SQL} AS actor_lost
                  FROM audit_logs a
                 WHERE a.chain_seq IS NOT NULL
            )
            SELECT chain_seq, entry_hash, created_at,
                   entry_hash IS NOT NULL AND recomputed = entry_hash AS hash_ok,
                   prev_hash IS NOT DISTINCT FROM previous_hash AS link_ok,
                   chain_seq <> COALESCE(previous_seq, 0) + 1 AS gap
              FROM chained
             WHERE NOT (entry_hash IS NOT NULL AND (recomputed = entry_hash OR actor_lost))
                OR prev_hash IS DISTINCT FROM previous_hash
                OR chain_seq <> COALESCE(previous_seq, 0) + 1
             ORDER BY chain_seq
             LIMIT 1`
        ),
        query<{ chained: string; unchained: string; unverifiable: string; first_at: Date | null; head_seq: string | null; head_hash: string | null; head_at: Date | null }>(
            `SELECT COUNT(*) FILTER (WHERE chain_seq IS NOT NULL) AS chained,
                    COUNT(*) FILTER (WHERE chain_seq IS NOT NULL AND ${ACTOR_LOST_SQL} AND entry_hash IS DISTINCT FROM ${entryHashSql('a')}) AS unverifiable,
                    COUNT(*) FILTER (WHERE chain_seq IS NULL) AS unchained,
                    MIN(created_at) FILTER (WHERE chain_seq IS NOT NULL) AS first_at,
                    (SELECT chain_seq FROM audit_logs WHERE chain_seq IS NOT NULL ORDER BY chain_seq DESC LIMIT 1) AS head_seq,
                    (SELECT entry_hash FROM audit_logs WHERE chain_seq IS NOT NULL ORDER BY chain_seq DESC LIMIT 1) AS head_hash,
                    (SELECT created_at FROM audit_logs WHERE chain_seq IS NOT NULL ORDER BY chain_seq DESC LIMIT 1) AS head_at
               FROM audit_logs a`
        ),
    ]);
    const count = counts.rows[0];
    const checkedEntries = Number(count?.chained ?? 0);
    const broken = rows[0];
    return {
        status: checkedEntries === 0 ? 'empty' : broken ? 'broken' : 'intact',
        checkedEntries,
        unchainedEntries: Number(count?.unchained ?? 0),
        unverifiableEntries: Number(count?.unverifiable ?? 0),
        firstChainedAt: count?.first_at ? new Date(count.first_at).toISOString() : null,
        head: count?.head_seq && count.head_hash
            ? { seq: Number(count.head_seq), hash: count.head_hash, at: new Date(count.head_at as Date).toISOString() }
            : null,
        problem: broken
            ? { seq: Number(broken.chain_seq), kind: broken.gap ? 'missing' : 'changed', at: new Date(broken.created_at).toISOString() }
            : null,
    };
}
