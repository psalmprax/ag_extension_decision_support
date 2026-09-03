/**
 * Database service barrel (pure move — no logic change).
 *
 * The implementation now lives in `services/db/`:
 * - `./db/pool` — pool state, `initializeDatabase`, `getPool`,
 *   `getPoolStats`, `closeDatabase`
 * - `./db/schema` — `createTables`
 * - `./db/query` — `TypedQueryResult`, `query`, `withTransaction`
 *
 * This thin barrel preserves every original export name so the 50+
 * existing `from '@/services/databaseService'` consumers keep working
 * with zero churn.
 */
export * from './db/pool';
export * from './db/schema';
export * from './db/query';
