import { query } from './databaseService';
import { logger } from '../utils/logger';

export interface LoginHistoryItem {
  id: string;
  userId: string | null;
  email: string;
  status: 'success' | 'failed';
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  location: string | null;
  createdAt: string;
}

export interface RecordLoginParams {
  userId?: string | null;
  email: string;
  status: 'success' | 'failed';
  failureReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
}

export interface QueryLoginHistoryParams {
  userId?: string;
  email?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface LoginStats {
  totalLogins: number;
  successfulLogins: number;
  failedAttempts24h: number;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

// fallow-ignore-next-line unused-export
export function parseDeviceFromUserAgent(userAgent?: string | null): string {
  if (!userAgent) return 'Unknown Device';
  const ua = userAgent.toLowerCase();

  let os = 'Unknown OS';
  if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = 'Browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('postman')) browser = 'Postman';
  else if (ua.includes('curl')) browser = 'cURL';

  return `${browser} on ${os}`;
}

// fallow-ignore-next-line unused-export
export function resolveLocationFromHeaders(
  headers: Record<string, string | string[] | undefined> = {},
  ipAddress?: string | null,
  userRegion?: string | null
): string {
  // Check Cloudflare / CDN geo headers
  const cfCity = headers['cf-ipcity'] as string | undefined;
  const cfCountry = headers['cf-ipcountry'] as string | undefined;
  if (cfCity && cfCountry) return `${cfCity}, ${cfCountry}`;
  if (cfCountry) return cfCountry;

  const geoCity = (headers['x-geo-city'] || headers['x-client-city']) as string | undefined;
  const geoCountry = (headers['x-geo-country'] || headers['x-client-country'] || headers['x-country-code']) as string | undefined;
  if (geoCity && geoCountry) return `${geoCity}, ${geoCountry}`;
  if (geoCountry) return geoCountry;

  // Check if loopback or private IP
  if (ipAddress) {
    const cleanIp = ipAddress.replace(/^::ffff:/, '');
    if (
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp === 'localhost' ||
      cleanIp.startsWith('10.') ||
      cleanIp.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(cleanIp)
    ) {
      return userRegion ? `${userRegion} (Local Node)` : 'Local Node / Development';
    }
  }

  // Fallback to user registered region or default
  return userRegion ? `${userRegion}, Kenya` : 'Nairobi, Kenya';
}

export async function recordLoginAttempt(params: RecordLoginParams): Promise<void> {
  const {
    userId = null,
    email,
    status,
    failureReason = null,
    ipAddress = null,
    userAgent = null,
    location = null,
  } = params;

  const device = params.device || parseDeviceFromUserAgent(userAgent);

  try {
    await query(
      `
      INSERT INTO login_history (
        user_id,
        email,
        status,
        failure_reason,
        ip_address,
        user_agent,
        device,
        location,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `,
      [userId, email.toLowerCase().trim(), status, failureReason, ipAddress, userAgent, device, location]
    );

    if (status === 'success' && userId) {
      await query(
        `
        UPDATE users
        SET last_login_at = NOW()
        WHERE id = $1
      `,
        [userId]
      );
    }
  } catch (error) {
    logger.error('Failed to record login attempt:', error);
  }
}

export async function getLoginHistory(
  params: QueryLoginHistoryParams = {}
): Promise<{ items: LoginHistoryItem[]; total: number }> {
  const { userId, email, status, limit = 50, offset = 0 } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    values.push(userId);
  }
  if (email) {
    conditions.push(`lower(email) = lower($${paramIdx++})`);
    values.push(email.trim());
  }
  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await query(
      `
      SELECT COUNT(*)::int AS total
      FROM login_history
      ${whereClause}
    `,
      values
    );
    const total = countResult.rows[0]?.total ?? 0;

    const listValues = [...values, limit, offset];
    const result = await query(
      `
      SELECT
        id,
        user_id as "userId",
        email,
        status,
        failure_reason as "failureReason",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        device,
        location,
        created_at as "createdAt"
      FROM login_history
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `,
      listValues
    );

    return {
      items: result.rows as LoginHistoryItem[],
      total,
    };
  } catch (error) {
    logger.error('Failed to get login history:', error);
    return { items: [], total: 0 };
  }
}

export async function getLoginStats(params: { userId?: string; email?: string } = {}): Promise<LoginStats> {
  const { userId, email } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    values.push(userId);
  } else if (email) {
    conditions.push(`lower(email) = lower($${paramIdx++})`);
    values.push(email.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const failedWhereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')} AND status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'`
    : `WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'`;

  try {
    const [countsRes, failedRes, lastSuccessRes] = await Promise.all([
      query(
        `
        SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'success' THEN 1 END)::int as successful
        FROM login_history
        ${whereClause}
      `,
        values
      ),
      query(
        `
        SELECT COUNT(*)::int as failed_24h
        FROM login_history
        ${failedWhereClause}
      `,
        values
      ),
      query(
        `
        SELECT created_at, ip_address
        FROM login_history
        ${whereClause ? `${whereClause} AND status = 'success'` : `WHERE status = 'success'`}
        ORDER BY created_at DESC
        LIMIT 1
      `,
        values
      ),
    ]);

    return {
      totalLogins: countsRes.rows[0]?.total ?? 0,
      successfulLogins: countsRes.rows[0]?.successful ?? 0,
      failedAttempts24h: failedRes.rows[0]?.failed_24h ?? 0,
      lastLoginAt: lastSuccessRes.rows[0]?.created_at ? new Date(lastSuccessRes.rows[0].created_at).toISOString() : null,
      lastLoginIp: lastSuccessRes.rows[0]?.ip_address ?? null,
    };
  } catch (error) {
    logger.error('Failed to calculate login stats:', error);
    return {
      totalLogins: 0,
      successfulLogins: 0,
      failedAttempts24h: 0,
      lastLoginAt: null,
      lastLoginIp: null,
    };
  }
}
