import { logger } from '@/utils/logger';

type RunQuery = (text: string, params: unknown[]) => Promise<{ rows: Array<{ tenant_id: string | null }> } | undefined>;

/** Where a new account's organisation comes from, most specific first. */
export interface NewUserTenantSources {
  /** The officer's regional manager: an officer works in their manager's organisation. */
  managerId?: string | null;
  /** The administrator who created the account. */
  creatorId?: string | null;
}

/**
 * Puts a new account in an organisation (tenant). Farmer records, visits and chats are only
 * reachable inside one organisation, so an account without one cannot work with any farmer,
 * even one assigned to it. The first source that belongs to an organisation decides; with
 * none, the account stays outside every organisation until an administrator links it.
 *
 * Never throws: the account is already created, and a failure leaves it as it was before.
 * Returns the organisation joined, or null.
 */
export async function joinNewUserTenant(run: RunQuery, userId: string, sources: NewUserTenantSources): Promise<string | null> {
  const candidates = [sources.managerId, sources.creatorId].filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (!userId || candidates.length === 0) return null;
  try {
    const result = await run(
      `UPDATE users u SET tenant_id = source.tenant_id, updated_at = NOW()
       FROM (
         SELECT tenant_id FROM users
         WHERE id = ANY($2::uuid[]) AND tenant_id IS NOT NULL AND COALESCE(is_active, true) = true
         ORDER BY array_position($2::uuid[], id)
         LIMIT 1
       ) source
       WHERE u.id = $1 AND u.tenant_id IS NULL
       RETURNING u.tenant_id`,
      [userId, candidates],
    );
    const tenantId = result?.rows?.[0]?.tenant_id ?? null;
    if (!tenantId) logger.warn(`New account ${userId} was not placed in an organisation: an administrator must link it`);
    return tenantId;
  } catch (error) {
    logger.warn(`New account ${userId} could not be placed in an organisation:`, error);
    return null;
  }
}
