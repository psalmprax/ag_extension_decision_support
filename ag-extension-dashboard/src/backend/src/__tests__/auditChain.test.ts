/**
 * The audit log hash chain: each entry links to the previous one, and the check reports the
 * first entry where the chain breaks. The SQL itself runs against Postgres in the real-backend
 * E2E (check:sql); here the order of operations and the report are pinned down.
 */
const txCalls: Array<[string, unknown[]]> = [];
let head: { chain_seq: string; entry_hash: string } | undefined;
const queryMock = jest.fn();

jest.mock('@/services/databaseService', () => ({
    query: (...args: unknown[]) => queryMock(...args),
    withTransaction: async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) => unknown) =>
        fn({
            query: async (sql: string, params: unknown[] = []) => {
                txCalls.push([sql, params]);
                if (sql.startsWith('SELECT chain_seq, entry_hash')) return { rows: head ? [head] : [] };
                if (sql.includes('RETURNING id')) return { rows: [{ id: 'new-entry' }] };
                return { rows: [] };
            },
        }),
}));

import { appendChainedAuditEntry, checkAuditChain, entryHashSql } from '@/services/audit/auditChain';

const VALUES = [null, 'admin', 'post.users', 'POST', '/api/v1/users', 'users', null, 201, '10.0.0.1', 'jest', '{}'] as const;

describe('appendChainedAuditEntry', () => {
    beforeEach(() => {
        txCalls.length = 0;
    });

    it('starts the chain at 1 with no previous hash', async () => {
        head = undefined;
        await appendChainedAuditEntry([...VALUES]);
        const insert = txCalls.find(([sql]) => sql.includes('INSERT INTO audit_logs'))!;
        expect(insert[1].slice(-2)).toEqual(['1', null]);
    });

    it('takes the lock first, then links the new entry to the newest one and hashes it', async () => {
        head = { chain_seq: '41', entry_hash: 'a'.repeat(64) };
        await appendChainedAuditEntry([...VALUES]);
        expect(txCalls[0][0]).toMatch(/pg_advisory_xact_lock/);
        const insert = txCalls.find(([sql]) => sql.includes('INSERT INTO audit_logs'))!;
        expect(insert[1].slice(-2)).toEqual(['42', 'a'.repeat(64)]);
        const update = txCalls[txCalls.length - 1];
        expect(update[0]).toContain(entryHashSql('a'));
        expect(update[1]).toEqual(['new-entry']);
    });

    it('hashes every stored column, including the previous hash and the time', () => {
        for (const column of ['chain_seq', 'prev_hash', 'actor_id', 'action', 'path', 'request_body', 'created_at']) {
            expect(entryHashSql('a')).toContain(`a.${column}`);
        }
    });
});

describe('checkAuditChain', () => {
    const counts = { chained: '12', unchained: '300', first_at: new Date('2026-12-02T09:00:00Z'), head_seq: '12', head_hash: 'f'.repeat(64), head_at: new Date('2026-12-03T10:00:00Z') };

    it('reports an intact chain with its newest hash', async () => {
        queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [counts] });
        const check = await checkAuditChain();
        expect(check).toMatchObject({ status: 'intact', checkedEntries: 12, unchainedEntries: 300, problem: null, head: { seq: 12, hash: 'f'.repeat(64) } });
    });

    it('names the first entry after a gap as missing entries', async () => {
        queryMock
            .mockResolvedValueOnce({ rows: [{ chain_seq: '7', entry_hash: 'x', created_at: new Date('2026-12-02T12:00:00Z'), hash_ok: true, link_ok: false, gap: true }] })
            .mockResolvedValueOnce({ rows: [counts] });
        expect((await checkAuditChain()).problem).toEqual({ seq: 7, kind: 'missing', at: '2026-12-02T12:00:00.000Z' });
    });

    it('names an entry whose content no longer matches its hash as changed', async () => {
        queryMock
            .mockResolvedValueOnce({ rows: [{ chain_seq: '3', entry_hash: 'x', created_at: new Date('2026-12-02T10:00:00Z'), hash_ok: false, link_ok: true, gap: false }] })
            .mockResolvedValueOnce({ rows: [counts] });
        const check = await checkAuditChain();
        expect(check.status).toBe('broken');
        expect(check.problem?.kind).toBe('changed');
    });

    it('says when nothing has been chained yet', async () => {
        queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ ...counts, chained: '0', head_seq: null, head_hash: null, first_at: null }] });
        expect(await checkAuditChain()).toMatchObject({ status: 'empty', head: null });
    });
});
