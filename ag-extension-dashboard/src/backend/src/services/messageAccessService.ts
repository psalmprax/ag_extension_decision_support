/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from './databaseService';
import { logger } from '@/utils/logger';

/** Error whose `statusCode` the route layer maps to an HTTP response. */
export class MessageAccessError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface MessageRecipient {
  /** Pre-resolved farmer id, if the caller passed one. */
  farmerId?: string | null;
  /** Raw phone number (SMS / WhatsApp). */
  phone?: string | null;
  /** Telegram chat id — resolved through `farmers.notes` LIKE '%tg:<id>%'. */
  telegramChatId?: string | null;
}

export interface MessagePrincipal {
  userId: string;
  role: string;
  region?: string | null;
  tenantId?: string | null;
}

interface FarmerWriteTarget {
  farmer_id: string | null;
  assigned_officer_id: string | null;
  user_id: string | null;
  region: string | null;
  tenant_id: string | null;
  is_active: boolean | null;
}

/**
 * Resolve a write target farmer from the caller's inputs (farmerId, phone, or a
 * Telegram chat id). Returns null when the recipient does not map to any farmer
 * (valid only for admin — officers/managers are denied by checkMessageAccess).
 */
async function resolveTargetFarmer(recipient: MessageRecipient): Promise<FarmerWriteTarget | null> {
  if (recipient.farmerId) {
    const { rows } = await query<FarmerWriteTarget>(
      `SELECT id AS farmer_id, assigned_officer_id, user_id, region, tenant_id, is_active
         FROM farmers WHERE id = $1`,
      [recipient.farmerId]
    );
    return rows[0] ?? null;
  }

  if (recipient.phone) {
    const digits = recipient.phone.replace(/\D/g, '');
    // Accept international, 0-prefixed, or bare variants; match on normalized digits.
    const variants = [
      `+${digits}`,
      ...(digits.startsWith('254') ? [`+${digits}`] : [`+254${digits.replace(/^0/, '')}`]),
      digits.replace(/^0/, digits.startsWith('0') ? '' : digits.replace(/^0/, '')),
    ];
    // Compare each candidate against the normalized DIGITS of the stored phone,
    // so formatting differences (+, 0-prefix, spaces) don't defeat the lookup.
    const { rows } = await query<FarmerWriteTarget>(
      `SELECT id AS farmer_id, assigned_officer_id, user_id, region, tenant_id, is_active
         FROM farmers
        WHERE phone IS NOT NULL
          AND (regexp_replace(phone, '\\D', '', 'g') = ANY($1))
        LIMIT 1`,
      [variants.map(v => v.replace(/\D/g, ''))]
    );
    return rows[0] ?? null;
  }

  if (recipient.telegramChatId) {
    const { rows } = await query<FarmerWriteTarget>(
      `SELECT id AS farmer_id, assigned_officer_id, user_id, region, tenant_id, is_active
         FROM farmers
        WHERE notes ILIKE '%tg:' || $1 || '%'
        LIMIT 1`,
      [String(recipient.telegramChatId)]
    );
    return rows[0] ?? null;
  }

  return null;
}

/**
 * Resolve a user's region. The JWT does not carry `region`, so it is loaded
 * from the DB on demand; callers may pass it in to skip the lookup.
 */
export async function resolvePrincipalRegion(userId: string): Promise<string | null> {
  const { rows } = await query<{ region: string | null }>(
    'SELECT region FROM users WHERE id = $1',
    [userId]
  );
  return rows[0]?.region ?? null;
}

/**
 * Enforce the outbound-message write scope:
 *  - extension_officer: recipient MUST be one of their assigned farmers; any
 *    other number / farmer / telegram chat id is denied (403).
 *  - regional_manager: recipient must be within their region.
 *  - admin / farmer-on-own-record: allowed.
 *
 * Returns the resolved farmerId (may be null for admins messaging ad-hoc
 * numbers). Throws MessageAccessError with a statusCode otherwise.
 */
export async function checkMessageAccess(
  principal: MessagePrincipal,
  recipient: MessageRecipient
): Promise<string | null> {
  const target = await resolveTargetFarmer(recipient);

  if (!target) {
    // No farmer matched — admins may contact ad-hoc numbers; scoped roles cannot.
    if (principal.role === 'admin') return recipient.farmerId ?? null;
    throw new MessageAccessError('You can only message farmers assigned to you.');
  }

  if (principal.role === 'admin') return target.farmer_id;

  if (principal.role === 'extension_officer') {
    if (target.assigned_officer_id === principal.userId) return target.farmer_id;
    throw new MessageAccessError('You can only message farmers assigned to you.');
  }

  if (principal.role === 'regional_manager') {
    const managerRegion = principal.region ?? (await resolvePrincipalRegion(principal.userId));
    if (!managerRegion || target.region !== managerRegion) {
      throw new MessageAccessError('You can only message farmers within your region.');
    }
    return target.farmer_id;
  }

  // farmer writes to their own officer are handled by the chatbot resolver, not here.
  throw new MessageAccessError('This role cannot message farmers directly.', 403);
}

/**
 * Convenience guard for bulk recipients: verify every target is writable by the
 * principal. Returns the resolved farmerId list aligned to the given recipients,
 * or throws on the first disallowed one.
 */
export async function assertAllRecipientsAllowed(
  principal: MessagePrincipal,
  recipients: Array<{ phone: string; farmerId?: string | null }>
): Promise<Array<string | null>> {
  const resolved: Array<string | null> = [];
  for (const r of recipients) {
    const farmerId = await checkMessageAccess(principal, { farmerId: r.farmerId, phone: r.phone });
    resolved.push(farmerId);
  }
  return resolved;
}

/** Map an unknown thrown value from these guards into a safe log line. */
export function messageAccessErrorDetail(error: unknown): string {
  if (error instanceof MessageAccessError) return error.message;
  if (error instanceof Error) {
    logger.error('Message access resolution failed:', error);
    return 'Failed to resolve message recipient.';
  }
  return 'Failed to resolve message recipient.';
}