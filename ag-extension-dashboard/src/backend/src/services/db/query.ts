import type { PoolClient } from 'pg';
import { getPool } from './pool';
import { logger } from '@/utils/logger';

/**
 * Shape returned by `query<T>()`. We use a custom return type (rather than
 * `pg.QueryResult<T>`) so callers don't have to satisfy `pg`'s
 * `QueryResultRow` constraint — the cast is trusted at the runtime boundary.
 */
export interface TypedQueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Default row type for untyped `query()` calls. Equivalent to
 * `pg.QueryResultRow` (`{ [column: string]: any }`) — preserves the
 * pre-generic behaviour so existing callers that do not pass a row type
 * continue to typecheck without modification. Prefer passing an explicit
 * row interface for new code.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultSqlRow = { [column: string]: any };

/**
 * Execute a raw SQL query against the connection pool with a typed row shape.
 *
 * Pass a row-type parameter to narrow the `rows` array. The default is
 * `DefaultSqlRow` (`{ [column: string]: any }`) which preserves the
 * pre-generic behaviour — new code should pass an explicit row interface
 * from `types/dbRows.ts` for strict typing.
 *
 * **Row-type pattern (canonical for the codebase):**
 * - The row interface mirrors the exact shape returned by the SQL (snake_case
 *   column names as the `pg` driver emits them).
 * - Prefer a row type from `types/dbRows.ts` when one already exists.
 * - For ad-hoc SQL, define a small row interface alongside the call site.
 * - The runtime cast is trusted: TypeScript does not verify that the SQL
 *   columns actually match `T`. Keep row types and SQL in sync.
 *
 * @example
 *   // Typed — preferred for new code
 *   const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
 *   // Untyped — preserved for backward compatibility with existing callers
 *   const { rows } = await query('SELECT now() AS now');
 *
 * @typeParam T - Row shape returned by the query. Defaults to `DefaultSqlRow`.
 */
export async function query<T = DefaultSqlRow>(
  text: string,
  params?: unknown[]
): Promise<TypedQueryResult<T>> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  return res as unknown as TypedQueryResult<T>;
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
