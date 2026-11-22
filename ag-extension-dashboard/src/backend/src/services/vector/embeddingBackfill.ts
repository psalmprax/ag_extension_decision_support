import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

/**
 * Embedding backfill: index every NULL-embedding row in batches until none
 * remain (or the provider is misconfigured). Used by the boot sequence and
 * the backfill CLI so large existing corpora are indexed progressively.
 */

export type UpsertFn = (id: string, content: string, metadata: Record<string, unknown>) => Promise<void>;

export async function backfillMissingEmbeddings(
    batchSize = 50,
    upsert: UpsertFn
): Promise<{ processed: number; failed: number; aborted?: string }> {
    const result = await processEmbeddingBatch(batchSize, upsert);
    if (result.processed || result.failed) {
        logger.info(`Embedding backfill: ${result.processed} embedded, ${result.failed} failed`);
    }
    return result;
}

/** Drain every NULL-embedding row in batches until none remain. */
export async function backfillAllMissingEmbeddings(
    batchSize = 100,
    maxBatches = 10_000,
    upsert: UpsertFn
): Promise<{ processed: number; failed: number; remaining: number; aborted?: string }> {
    let processed = 0;
    let failed = 0;
    let aborted: string | undefined;
    for (let i = 0; i < maxBatches; i++) {
        const r = await backfillMissingEmbeddings(batchSize, upsert);
        processed += r.processed;
        failed += r.failed;
        if (r.aborted) { aborted = r.aborted; break; }
        // Nothing embedded in this batch: either nothing is left, or every row failed.
        // Fetching the same rows again would only repeat the failure.
        if (r.processed === 0) break;
    }
    return { processed, failed, remaining: await countRemaining(), aborted };
}

async function countRemaining(): Promise<number> {
    try {
        const c = await query(`SELECT COUNT(*)::int AS n FROM knowledge_articles WHERE embedding IS NULL`);
        return Number(c.rows[0]?.n ?? 0);
    } catch (err) {
        logger.warn('Could not count articles still without an embedding:', err);
        return 0;
    }
}

/** An error that will fail every row the same way, so the backfill stops instead of retrying. */
function abortReason(err: unknown): string | undefined {
    const error = err as { name?: string; message?: string };
    if (error?.name === 'EmbeddingDimensionError') return `embedding width mismatch: ${error.message ?? ''}`.trim();
    if (error?.name === 'AIUnavailableError') {
        return 'no embedding provider is available';
    }
    return undefined;
}

async function processEmbeddingBatch(batchSize: number, upsert: UpsertFn): Promise<{ processed: number; failed: number; aborted?: string }> {
    let processed = 0;
    let failed = 0;
    let rows: Array<Record<string, unknown>>;
    try {
        rows = await fetchRowsMissingEmbeddings(batchSize);
    } catch (err) {
        logger.warn('Embedding backfill query failed:', err);
        return { processed, failed };
    }
    for (const row of rows) {
        try {
            await embedRow(row, upsert);
            processed++;
        } catch (err) {
            failed++;
            const aborted = abortReason(err);
            if (aborted) return { processed, failed, aborted };
        }
    }
    return { processed, failed };
}

async function fetchRowsMissingEmbeddings(batchSize: number): Promise<Array<Record<string, unknown>>> {
    const res = await query(
        `SELECT id, title, content, category, tags, crops, regions, source, source_url, content_type
           FROM knowledge_articles WHERE embedding IS NULL ORDER BY created_at ASC LIMIT $1`,
        [batchSize]
    );
    return res.rows as Array<Record<string, unknown>>;
}

function embedRow(row: Record<string, unknown>, upsert: UpsertFn): Promise<void> {
    return upsert(String(row.id), String(row.content || ''), {
        title: row.title,
        category: row.category,
        tags: row.tags || [],
        crops: row.crops || [],
        regions: row.regions || [],
        source: row.source || null,
        sourceUrl: row.source_url || null,
        contentType: row.content_type || 'text',
    });
}
