import { executeIdempotentMutation } from '../services/idempotencyService';
import { withTransaction } from '../services/databaseService';
import type { PoolClient } from 'pg';

jest.mock('../services/databaseService', () => ({
    withTransaction: jest.fn(),
}));

const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

describe('idempotencyService', () => {
    const mockClientQuery = jest.fn();
    const client = {
        query: mockClientQuery,
    } as unknown as PoolClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClientQuery.mockReset();
        mockWithTransaction.mockImplementation(async callback => callback(client));
    });

    it('reserves, executes, and stores a completed mutation response', async () => {
        mockClientQuery
            .mockResolvedValueOnce({ rows: [{ request_hash: 'reserved', status: 'processing' }] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await executeIdempotentMutation(
            {
                userId: 'user-1',
                mutationKey: 'mutation-1',
                operation: 'create',
                entityType: 'visit',
                payload: { farmerId: 'farmer-1', notes: 'Visit' },
            },
            async () => ({ status: 201, body: { success: true, data: { id: 'visit-1' } } })
        );

        expect(result).toEqual({ status: 201, body: { success: true, data: { id: 'visit-1' } } });
        expect(mockClientQuery).toHaveBeenCalledTimes(2);
        expect(mockClientQuery.mock.calls[1][0]).toContain("SET status = 'completed'");
    });

    it('replays a completed response without executing the mutation again', async () => {
        mockClientQuery
            .mockResolvedValueOnce({ rows: [{ request_hash: 'reserved', status: 'processing' }] })
            .mockResolvedValueOnce({ rows: [] });
        const mutation = jest.fn().mockResolvedValue({
            status: 201,
            body: { success: true, data: { id: 'visit-1' } },
        });
        const options = {
            userId: 'user-1',
            mutationKey: 'mutation-1',
            operation: 'create',
            entityType: 'visit',
            payload: { farmerId: 'farmer-1' },
        } as const;

        await executeIdempotentMutation(options, mutation);
        const requestHash = mockClientQuery.mock.calls[0][1][4];
        mockClientQuery.mockReset();
        mockClientQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    request_hash: requestHash,
                    status: 'completed',
                    response_status: 201,
                    response_body: { success: true, data: { id: 'visit-1' } },
                }],
            });

        const result = await executeIdempotentMutation(options, mutation);

        expect(result).toEqual({ status: 201, body: { success: true, data: { id: 'visit-1' } } });
        expect(mutation).toHaveBeenCalledTimes(1);
    });

    it('returns a conflict when a key is reused with a different payload', async () => {
        mockClientQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    request_hash: 'different-request-hash',
                    status: 'completed',
                    response_status: 201,
                    response_body: { success: true },
                }],
            });

        const result = await executeIdempotentMutation(
            {
                userId: 'user-1',
                mutationKey: 'mutation-1',
                operation: 'create',
                entityType: 'visit',
                payload: { farmerId: 'farmer-2' },
            },
            jest.fn()
        );

        expect(result.status).toBe(409);
        expect(result.body.errorCode).toBe('IDEMPOTENCY_KEY_REUSED');
        expect(result.body.syncState).toBe('conflict');
    });
});
