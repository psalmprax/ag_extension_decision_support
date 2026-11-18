import crypto from "crypto";
import type { PoolClient } from "pg";
import { query } from "./databaseService";
import { withTransaction } from "./db/query";
import { logger } from "../utils/logger";
import { addToSet, inSet } from "./sharedState";
import { parseDeviceFromUserAgent } from "./loginHistoryService";

export interface UserSessionRecord {
  id: string;
  userId: string;
  tokenHash?: string;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  location: string | null;
  lastActiveAt: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  isCurrent?: boolean;
}

const REVOKED_SET = "session:revoked";
// Revocation entries only need to outlive the token itself.
const REVOKED_TTL_MS = 8 * 24 * 60 * 60 * 1000;
const REVOCATION_CACHE_CLEANUP_INTERVAL = 256;

// Fast-path cache for revocations performed by this process. The authoritative
// source is the `user_sessions.is_revoked` column; this cache only avoids a DB
// round-trip for the common "just revoked here" case.
const revokedTokenHashes = new Map<string, number>();
let revocationCacheWritesSinceCleanup = 0;

function isLocallyRevoked(tokenHash: string): boolean {
  const expiresAt = revokedTokenHashes.get(tokenHash);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    revokedTokenHashes.delete(tokenHash);
    return false;
  }
  return true;
}

function rememberLocalRevocation(tokenHash: string): void {
  const now = Date.now();
  revokedTokenHashes.set(tokenHash, now + REVOKED_TTL_MS);

  if (++revocationCacheWritesSinceCleanup >= REVOCATION_CACHE_CLEANUP_INTERVAL) {
    for (const [hash, expiresAt] of revokedTokenHashes) {
      if (expiresAt <= now) revokedTokenHashes.delete(hash);
    }
    revocationCacheWritesSinceCleanup = 0;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const USER_SESSION_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext($1))";

/**
 * Acquire the per-user transaction-scoped session advisory lock on an existing
 * transaction client. Callers updating user credentials/roles and revoking
 * sessions inside a transaction MUST acquire this before locking `users` rows
 * so lock order matches `withUserSessionLock` (`login`, `mfa`, `refresh`,
 * `account/password`) and prevents concurrent refreshes from surviving
 * revocation.
 */
export async function acquireUserSessionLock(
  client: PoolClient,
  userId: string,
): Promise<void> {
  await client.query(USER_SESSION_LOCK_SQL, [userId]);
}

export async function withUserSessionLock<T>(
  userId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  try {
    return await withTransaction(async client => {
      await acquireUserSessionLock(client, userId);
      return callback(client);
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'test' && error instanceof Error && error.message === 'Database not initialized') {
      const fallbackClient = {
        query: (text: string, params?: unknown[]) => query(text, params),
        release: () => {},
      } as unknown as PoolClient;
      return callback(fallbackClient);
    }
    throw error;
  }
}

/**
 * Validate a bearer token against the session store.
 * - Revoked or expired session row → false
 * - No session row (legacy/demo tokens issued without createSession) → true
 * - DB error → false (fail-closed on security state, logged). Callers enforce
 *   JWT signature/expiry independently; unknown revocation state must not pass.
 */
export async function isSessionValid(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);
  if (isLocallyRevoked(tokenHash)) return false;

  // Cross-replica revocations can reject a request without a database round trip.
  if (await inSet(REVOKED_SET, tokenHash)) {
    rememberLocalRevocation(tokenHash);
    return false;
  }

  // Recheck account status on every request, including when another replica disabled it.
  return await checkSessionInDatabase(tokenHash);
}

async function checkSessionInDatabase(tokenHash: string): Promise<boolean> {
  try {
    const res = await query(
      `SELECT s.is_revoked, s.expires_at, u.is_active
       FROM user_sessions s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    const row = res.rows[0] as
      { is_revoked: boolean; expires_at: string | Date; is_active: boolean | null } | undefined;
    if (!row) {
      // Legacy/demo tokens issued without createSession. Default denies them
      // in production and allows them elsewhere for backwards compatibility;
      // SESSION_ALLOW_LEGACY_NO_ROW_TOKENS overrides explicitly either way.
      const flag = process.env.SESSION_ALLOW_LEGACY_NO_ROW_TOKENS;
      const legacyAllowed = flag !== undefined ? flag === 'true' : process.env.NODE_ENV !== 'production';
      if (!legacyAllowed) {
        logger.warn('Rejecting bearer token with no session row (legacy tokens disabled)');
        return false;
      }
      logger.warn('Allowing bearer token with no session row (legacy/demo token; JWT still enforced by caller)');
    } else {
      if (row.is_revoked || row.is_active !== true) {
        rememberLocalRevocation(tokenHash);
        return false;
      }

      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.warn(
      "Session validity lookup failed; denying request on unknown revocation state:",
      error,
    );
    return false;
  }
}

function markRevokedLocally(tokenHash: string): void {
  rememberLocalRevocation(tokenHash);
  // Best-effort publish to other replicas; the DB row is still authoritative.
  // Guard both synchronous throws and non-thenable test doubles so post-commit
  // cache publication can never turn a committed transaction into a 500.
  try {
    void Promise.resolve(addToSet(REVOKED_SET, tokenHash, REVOKED_TTL_MS)).catch((err: unknown) =>
      logger.warn("Failed to publish session revocation to shared state:", err),
    );
  } catch (err: unknown) {
    logger.warn("Failed to publish session revocation to shared state:", err);
  }
}

export async function createSession(params: {
  userId: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
  expiresInSeconds?: number;
}, client?: PoolClient): Promise<string> {
  const {
    userId,
    token,
    ipAddress = null,
    userAgent = null,
    location = null,
    expiresInSeconds = 7 * 24 * 3600, // 7 days default
  } = params;

  const tokenHash = hashToken(token);
  const device = params.device || parseDeviceFromUserAgent(userAgent);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  try {
    const statement = `
      INSERT INTO user_sessions (
        user_id,
        token_hash,
        ip_address,
        user_agent,
        device,
        location,
        last_active_at,
        expires_at,
        is_revoked,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, false, NOW())
      RETURNING id
    `;
    const values = [userId, tokenHash, ipAddress, userAgent, device, location, expiresAt];
    const res = client
      ? await client.query(statement, values)
      : await query(statement, values);

    return res.rows[0]?.id;
  } catch (error) {
    logger.error("Failed to create user session:", error);
    throw error;
  }
}

/**
 * Revoke a session by raw bearer token (logout). Marks the DB row revoked and
 * publishes the revocation cross-replica so the token dies immediately.
 * Returns false when no session row exists (legacy/demo tokens issued without
 * createSession) — callers still get a valid logout because revokeToken's
 * in-process/Redis revocation list makes isSessionValid fail for the token.
 */
export async function revokeSessionByToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  // Publish first so a concurrent request on any replica sees the revocation
  // even if the DB update below fails or the row is missing.
  markRevokedLocally(tokenHash);
  try {
    const res = await query(
      `UPDATE user_sessions SET is_revoked = true WHERE token_hash = $1 AND is_revoked = false`,
      [tokenHash],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    logger.error("Failed to revoke session by token:", error);
    return false;
  }
}

export function revokeToken(token: string): void {
  markRevokedLocally(hashToken(token));
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  try {
    const res = await query(
      `
      UPDATE user_sessions
      SET is_revoked = true
      WHERE id = $1 AND user_id = $2
      RETURNING token_hash
    `,
      [sessionId, userId],
    );

    if (res.rows.length > 0) {
      if (res.rows[0]?.token_hash) {
        markRevokedLocally(res.rows[0].token_hash);
      }

      return true;
    }

    return false;
  } catch (error) {
    logger.error("Failed to revoke session:", error);
    return false;
  }
}

const REVOKE_ALL_USER_SESSIONS_SQL =
  "UPDATE user_sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false RETURNING token_hash";

export interface TransactionalSessionRevocation {
  revokedCount: number;
  tokenHashes: string[];
}

function extractTokenHashes(rows: Array<{ token_hash?: unknown }>): string[] {
  const hashes: string[] = [];
  for (const row of rows) {
    if (typeof row.token_hash === "string" && row.token_hash.length > 0) {
      hashes.push(row.token_hash);
    }
  }
  return hashes;
}

/**
 * Publish committed session revocations to the in-process fast-path cache and
 * shared Redis set. Callers executing revocation inside a transaction MUST call
 * this only after COMMIT succeeds so rolled-back updates never poison caches.
 */
export function publishSessionRevocations(tokenHashes: readonly string[]): void {
  for (const tokenHash of tokenHashes) {
    if (tokenHash) markRevokedLocally(tokenHash);
  }
}

/**
 * Revoke every active session for a user inside an existing database
 * transaction without publishing cache entries yet. Pair with
 * `publishSessionRevocations(result.tokenHashes)` strictly post-commit.
 */
export async function revokeAllUserSessionsInTransaction(
  client: PoolClient,
  userId: string,
): Promise<TransactionalSessionRevocation> {
  try {
    const res = await client.query<{ token_hash?: string | null }>(
      REVOKE_ALL_USER_SESSIONS_SQL,
      [userId],
    );
    const rows = res.rows ?? [];
    return {
      revokedCount: res.rowCount ?? rows.length,
      tokenHashes: extractTokenHashes(rows),
    };
  } catch (error) {
    logger.error("Failed to revoke all user sessions:", error);
    throw error;
  }
}

/** Revoke every session for a user (password reset, account deletion, admin lock). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  try {
    const res = await query<{ token_hash?: string | null }>(
      REVOKE_ALL_USER_SESSIONS_SQL,
      [userId],
    );
    const rows = res.rows ?? [];
    publishSessionRevocations(extractTokenHashes(rows));
    return res.rowCount ?? rows.length;
  } catch (error) {
    logger.error("Failed to revoke all user sessions:", error);
    throw error;
  }
}

export async function revokeAllOtherSessions(
  userId: string,
  currentToken: string,
): Promise<number> {
  const currentTokenHash = hashToken(currentToken);

  try {
    const res = await query(
      `
      UPDATE user_sessions
      SET is_revoked = true
      WHERE user_id = $1 AND token_hash != $2 AND is_revoked = false
      RETURNING token_hash
    `,
      [userId, currentTokenHash],
    );

    for (const row of res.rows) {
      if (row.token_hash) {
        markRevokedLocally(row.token_hash);
      }
    }

    return res.rowCount ?? res.rows.length ?? 0;
  } catch (error) {
    logger.error("Failed to revoke other sessions:", error);
    return 0;
  }
}

export async function getUserSessions(
  userId: string,
  currentToken?: string,
): Promise<UserSessionRecord[]> {
  const currentTokenHash = currentToken ? hashToken(currentToken) : null;

  try {
    const res = await query(
      `
      SELECT
        id,
        user_id AS "userId",
        token_hash AS "tokenHash",
        ip_address AS "ipAddress",
        user_agent AS "userAgent",
        device,
        location,
        last_active_at AS "lastActiveAt",
        expires_at AS "expiresAt",
        is_revoked AS "isRevoked",
        created_at AS "createdAt"
      FROM user_sessions
      WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
      ORDER BY last_active_at DESC
    `,
      [userId],
    );

    return res.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: String(row.userId),
      tokenHash: undefined,
      ipAddress: (row.ipAddress as string) || null,
      userAgent: (row.userAgent as string) || null,
      device: (row.device as string) || null,
      location: (row.location as string) || null,
      lastActiveAt: String(row.lastActiveAt),
      expiresAt: String(row.expiresAt),
      isRevoked: Boolean(row.isRevoked),
      createdAt: String(row.createdAt),
      isCurrent: currentTokenHash ? row.tokenHash === currentTokenHash : false,
    }));
  } catch (error) {
    logger.error("Failed to fetch user sessions:", error);
    return [];
  }
}
