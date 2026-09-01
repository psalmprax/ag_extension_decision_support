import crypto from 'crypto';
import { query } from './databaseService';
import { logger } from '../utils/logger';
import { parseDeviceFromUserAgent } from './loginHistoryService';

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

const revokedTokenHashes = new Set<string>();

// fallow-ignore-next-line unused-export
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isSessionValid(token: string): boolean {
  if (!token) return false;
  const tokenHash = hashToken(token);
  return !revokedTokenHashes.has(tokenHash);
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
      [userId, tokenHash, ipAddress, userAgent, device, location, expiresAt]
    );

    return res.rows[0]?.id;
  } catch (error) {
    logger.error('Failed to create user session:', error);
    throw error;
  }
}

// fallow-ignore-next-line unused-export
export function revokeToken(token: string): void {
  revokedTokenHashes.add(hashToken(token));
}

export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  try {
    const res = await query(
      `
      UPDATE user_sessions
      SET is_revoked = true
      WHERE id = $1 AND user_id = $2
      RETURNING token_hash
    `,
      [sessionId, userId]
    );

    if (res.rows.length > 0) {
      if (res.rows[0]?.token_hash) {
        revokedTokenHashes.add(res.rows[0].token_hash);
      }
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to revoke session:', error);
    return false;
  }
}

export async function revokeAllOtherSessions(userId: string, currentToken: string): Promise<number> {
  const currentTokenHash = hashToken(currentToken);

  try {
    const res = await query(
      `
      UPDATE user_sessions
      SET is_revoked = true
      WHERE user_id = $1 AND token_hash != $2 AND is_revoked = false
      RETURNING token_hash
    `,
      [userId, currentTokenHash]
    );

    for (const row of res.rows) {
      if (row.token_hash) {
        revokedTokenHashes.add(row.token_hash);
      }
    }

    return res.rowCount ?? res.rows.length ?? 0;
  } catch (error) {
    logger.error('Failed to revoke other sessions:', error);
    return 0;
  }
}

export async function getUserSessions(userId: string, currentToken?: string): Promise<UserSessionRecord[]> {
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
      [userId]
    );

    return res.rows.map(row => ({
      ...row,
      tokenHash: undefined, // Redact token hash from response
      isCurrent: currentTokenHash ? row.tokenHash === currentTokenHash : false,
    }));
  } catch (error) {
    logger.error('Failed to fetch user sessions:', error);
    return [];
  }
}
