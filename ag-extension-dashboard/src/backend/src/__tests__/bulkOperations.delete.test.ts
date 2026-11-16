/**
 * Bulk deletes must report what really happened. The fake transaction below
 * behaves like Postgres: work inside it is only kept if the callback resolves.
 */
const committed: string[] = [];
// (Postgres semantics are modelled in the fake $transaction below.)

jest.mock('../services/prismaService', () => ({
    getPrisma: () => ({
        $transaction: async (fn: (tx: unknown) => Promise<void>) => {
            const pending: string[] = [];
            let aborted = false;
            const tx = {
                farmer: {
                    delete: async ({ where }: { where: { id: string } }) => {
                        // Postgres: after any error the transaction accepts no more statements.
                        if (aborted) throw new Error('current transaction is aborted, commands ignored until end of transaction block');
                        if (where.id.startsWith('blocked')) {
                            aborted = true;
                            throw new Error('violates foreign key constraint');
                        }
                        pending.push(where.id);
                    },
                },
            };
            await fn(tx); // a rejected callback rolls everything back
            if (!aborted) committed.push(...pending); // COMMIT of an aborted transaction is a ROLLBACK
        },
    }),
}));
jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { bulkOperationsService } from '../services/bulkOperationsService';

describe('bulkDeleteFarmers', () => {
    beforeEach(() => committed.splice(0));

    it('counts exactly the farmers that were deleted when one in the batch fails', async () => {
        const result = await bulkOperationsService.bulkDeleteFarmers({ ids: ['f1', 'blocked-2', 'f3'] }, 'admin-1', 'admin');
        // Previously: one shared transaction, reported "2 processed", committed nothing.
        expect(committed).toEqual(['f1', 'f3']);
        expect(result).toMatchObject({ success: false, processed: 2, failed: 1 });
        expect(result.errors[0]).toContain('blocked-2');
    });

    it('reports success when every farmer was deleted', async () => {
        const result = await bulkOperationsService.bulkDeleteFarmers({ ids: ['f1', 'f2'] }, 'admin-1', 'admin');
        expect(committed).toEqual(['f1', 'f2']);
        expect(result).toMatchObject({ success: true, processed: 2, failed: 0, errors: [] });
    });
});
