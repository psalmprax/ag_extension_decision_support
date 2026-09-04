/**
 * One-shot embedding backfill.
 *
 *   npm run backfill:embeddings            # drain all NULL-embedding articles
 *   npm run backfill:embeddings -- 100     # custom batch size
 *
 * Idempotent: each pass only touches rows where embedding IS NULL. Exits non-zero
 * if the embedding provider is misconfigured (dimension mismatch) so CI/ops see it.
 */
import { initializeDatabase, closeDatabase } from '@/services/databaseService';
import { initializeCache, closeCache } from '@/services/cacheService';
import { VectorService } from '@/services/vectorService';
import { logger } from '@/utils/logger';

async function main(): Promise<void> {
  const batch = Math.max(1, parseInt(process.argv[2] || '100', 10) || 100);
  await initializeDatabase();
  await initializeCache().catch(() => undefined);

  const summary = await VectorService.backfillAllMissingEmbeddings(batch);
  logger.info(`Backfill complete: ${summary.processed} embedded, ${summary.failed} failed, ${summary.remaining} remaining`);
  if (summary.aborted) {
    logger.error(`Backfill aborted: ${summary.aborted}`);
    process.exitCode = 2;
  }
}

main()
  .catch(err => {
    logger.error('Backfill crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeCache().catch(() => undefined);
    await closeDatabase().catch(() => undefined);
  });
