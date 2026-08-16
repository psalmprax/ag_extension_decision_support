import { PoolClient } from 'pg';
import { withTransaction } from '@/services/databaseService';
import { createHash } from 'crypto';

export interface IdempotentMutationResult {
    status: number;
    body: Record<string, unknown>;
}

interface StoredMutationRow {
    request_hash: string;
    status: 'processing' | 'completed';
    response_status: number | null;
    response_body: Record<string, unknown> | null;
}

interface IdempotentMutationOptions {
    userId: string;
    mutationKey: string;
    operation: string;
    entityType: string;
    payload: Record<string, unknown>;
}

function hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function executeIdempotentMutation(
    options: IdempotentMutationOptions,
    mutation: (client: PoolClient) => Promise<IdempotentMutationResult>
): Promise<IdempotentMutationResult> {
    const requestHash = hashPayload(options.payload);

    return withTransaction(async client => {
        const reservation = await client.query<StoredMutationRow>(
            `INSERT INTO offline_mutations
                (user_id, mutation_key, operation, entity_type, request_hash, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'processing', NOW(), NOW())
             ON CONFLICT (user_id, mutation_key) DO NOTHING
             RETURNING request_hash, status, response_status, response_body`,
            [options.userId, options.mutationKey, options.operation, options.entityType, requestHash]
        );

        if (reservation.rows.length === 0) {
            const existing = await client.query<StoredMutationRow>(
                `SELECT request_hash, status, response_status, response_body
                 FROM offline_mutations
                 WHERE user_id = $1 AND mutation_key = $2`,
                [options.userId, options.mutationKey]
            );
            const stored = existing.rows[0];

            if (!stored || stored.request_hash !== requestHash) {
                return {
                    status: 409,
                    body: {
                        success: false,
                        errorCode: 'IDEMPOTENCY_KEY_REUSED',
                        syncState: 'conflict',
                        error: 'The idempotency key was already used for a different mutation',
                    },
                };
            }

            if (stored.status === 'completed' && stored.response_status && stored.response_body) {
                return {
                    status: stored.response_status,
                    body: stored.response_body,
                };
            }

            return {
                status: 409,
                body: {
                    success: false,
                    errorCode: 'IDEMPOTENCY_IN_PROGRESS',
                    syncState: 'retry',
                    error: 'This mutation is already being processed',
                },
            };
        }

        const result = await mutation(client);
        await client.query(
            `UPDATE offline_mutations
             SET status = 'completed', response_status = $1, response_body = $2, updated_at = NOW()
             WHERE user_id = $3 AND mutation_key = $4`,
            [result.status, JSON.stringify(result.body), options.userId, options.mutationKey]
        );
        return result;
    });
}
