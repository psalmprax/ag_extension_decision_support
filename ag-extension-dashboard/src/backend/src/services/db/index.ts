/**
 * Database service barrel (pure move of `services/databaseService.ts`).
 *
 * `pool.ts` owns the single `pg.Pool` module state; `schema.ts` and
 * `query.ts` access it via `getPool()` — state is never duplicated.
 * Existing `import ... from '@/services/databaseService'` imports keep
 * working via the thin re-export barrel in `services/databaseService.ts`.
 */
export * from './pool';
export * from './schema';
export * from './query';
