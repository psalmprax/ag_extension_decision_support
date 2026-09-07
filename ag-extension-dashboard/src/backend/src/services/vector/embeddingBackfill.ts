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
        if (r.processed === 0 && r.failed === 0) break; // nothing left
        if (r.processed === 0 && r.failed > 0) break;   // every row in the batch failed — stop looping
    }
    let remaining = 0;
    try {
        const c = await query(`SELECT COUNT(*)::int AS n FROM knowledge_articles WHERE embedding IS NULL`);
        remaining = Number(c.rows[0]?.n ?? 0);
    } catch { /* table may not exist */ }
    return { processed, failed, remaining, aborted };
}

async function processEmbeddingBatch(batchSize: number, upsert: UpsertFn): Promise<{ processed: number; failed: number; aborted?: string }> {
    let processed = 0;
    const failed: number[] = [];
    const aborted: string | undefined = undefined;
    try {
        const rows = await fetchRowsMissingEmbeddings(batchSize);
        for (const row of rows) {
            try {
                await processSingleEmbedding(row, upsert);
                processed++;
            } catch {
                failed.push(1);
            }
        }
    } catch (err) {
        logger.warn('Embedding backfill query failed:', err);
    }
    return { processed, failed: failed.length, aborted };
}

async function fetchRowsMissingEmbeddings(batchSize: number): Promise<Array<Record<string, unknown>>> {
    const res = await query(
        `SELECT id, title, content, category, tags, crops, regions, source, source_url, content_type
           FROM knowledge_articles WHERE embedding IS NULL ORDER BY created_at ASC LIMIT $1`,
        [batchSize]
    );
    return res.rows as Array<Record<string, unknown>>;
}

async function processSingleEmbedding(row: Record<string, unknown>, upsert: UpsertFn): Promise<void> {
    try {
        await upsert(String(row.id), String(row.content || ''), {
            title: row.title,
            category: row.category,
            tags: row.tags || [],
            crops: row.crops || [],
            regions: row.regions || [],
            source: row.source || null,
            sourceUrl: row.source_url || null,
            contentType: row.content_type || 'text',
        });
    } catch (err) {
        if ((err as Error)?.name === 'EmbeddingDimensionError') {
            throw err;
        }
    }
}
