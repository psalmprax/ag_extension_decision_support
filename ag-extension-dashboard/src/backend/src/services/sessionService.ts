import crypto from "crypto";
import { query } from "./databaseService";
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

// Fast-path set for revocations performed by this process. The authoritative
// source is the `user_sessions.is_revoked` column; this set only avoids a DB
// round-trip for the common "just revoked here" case.
const revokedTokenHashes = new Set<string>();

// Short-lived positive cache so hot paths don't hit the DB on every request.
// Revocation invalidates the entry immediately in-process; other instances see
// the DB change within VALIDITY_CACHE_TTL_MS.
const VALIDITY_CACHE_TTL_MS = 30_000;
const validityCache = new Map<string, number>(); // tokenHash -> expiresAt(ms)

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Validate a bearer token against the session store.
 * - Revoked or expired session row → false
 * - No session row (legacy/demo tokens issued without createSession) → true
 * - DB error → true (fail-open on availability, logged) so an outage doesn't
 *   lock every user out; JWT signature/expiry is still enforced by the caller.
 */
export async function isSessionValid(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);
  if (revokedTokenHashes.has(tokenHash)) return false;

  // Cross-replica revocation list (Redis). Checked before the positive cache so a
  // revoke on another node takes effect immediately rather than after 30s.
  if (await inSet(REVOKED_SET, tokenHash)) {
    revokedTokenHashes.add(tokenHash);
    validityCache.delete(tokenHash);
    return false;
  }

  const cachedUntil = validityCache.get(tokenHash);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  return await checkSessionInDatabase(tokenHash);
}

async function checkSessionInDatabase(tokenHash: string): Promise<boolean> {
  try {
    const res = await query(
      `SELECT is_revoked, expires_at FROM user_sessions WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    const row = res.rows[0] as
      { is_revoked?: boolean; expires_at?: string | Date } | undefined;
    if (row) {
      if (row.is_revoked) {
        revokedTokenHashes.add(tokenHash);
        return false;
      }

      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        return false;
      }
    }

    updateValidityCache(tokenHash);
    return true;
  } catch (error) {
    logger.warn(
      "Session validity lookup failed; allowing request on JWT alone:",
      error,
    );
    return true;
  }
}

function updateValidityCache(tokenHash: string): void {
  validityCache.set(tokenHash, Date.now() + VALIDITY_CACHE_TTL_MS);
  if (validityCache.size > 10_000) {
    const now = Date.now();
    for (const [k, v] of validityCache) if (v <= now) validityCache.delete(k);
  }
}

const REVOKED_SET = "session:revoked";
// Revocation entries only need to outlive the token itself.
const REVOKED_TTL_MS = 8 * 24 * 60 * 60 * 1000;

function markRevokedLocally(tokenHash: string): void {
  revokedTokenHashes.add(tokenHash);
  validityCache.delete(tokenHash);
  // Best-effort publish to other replicas; the DB row is still authoritative.
  void addToSet(REVOKED_SET, tokenHash, REVOKED_TTL_MS).catch((err: unknown) =>
    logger.warn("Failed to publish session revocation to shared state:", err),
  );
}

export async function createSession(params: {
  userId: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
  expiresInSeconds?: number;
}): Promise<string> {
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
    const res = await query(
      `
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
    `,
      [userId, tokenHash, ipAddress, userAgent, device, location, expiresAt],
    );

    return res.rows[0]?.id;
  } catch (error) {
    logger.error("Failed to create user session:", error);
    throw error;
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

/** Revoke every session for a user (password reset, account deletion, admin lock). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  try {
    const res = await query(
      `UPDATE user_sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false RETURNING token_hash`,
      [userId],
    );
    for (const row of res.rows) {
      if (row.token_hash) markRevokedLocally(row.token_hash);
    }

    return res.rowCount ?? res.rows.length ?? 0;
  } catch (error) {
    logger.error("Failed to revoke all user sessions:", error);
    return 0;
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
