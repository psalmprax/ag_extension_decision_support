import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export interface RequestPrincipal {
  userId: string;
  role: string;
}

interface FarmerScopeRow {
  id: string;
  user_id: string | null;
  assigned_officer_id: string | null;
  region: string | null;
  tenant_id: string | null;
  is_active: boolean | null;
}

async function isTenantMember(farmer: FarmerScopeRow, principal: RequestPrincipal): Promise<boolean> {
  if (principal.role === 'admin') return true;
  const membership = await query<{ tenant_id: string | null }>(
    'SELECT tenant_id FROM users WHERE id = $1 AND is_active = true',
    [principal.userId]
  );
  const principalTenantId = membership.rows[0]?.tenant_id;
  return Boolean(principalTenantId && farmer.tenant_id && principalTenantId === farmer.tenant_id);
}

async function hasRoleAccess(farmer: FarmerScopeRow, principal: RequestPrincipal): Promise<boolean> {
  switch (principal.role) {
    case 'admin':
      return true;
    case 'farmer':
      return farmer.user_id === principal.userId;
    case 'extension_officer':
      return farmer.assigned_officer_id === principal.userId;
    case 'regional_manager': {
      const manager = await query<{ region: string | null }>('SELECT region FROM users WHERE id = $1', [principal.userId]);
      return Boolean(manager.rows[0]?.region && manager.rows[0].region === farmer.region);
    }
    default:
      return false;
  }
}

export async function getFarmerForPrincipal(farmerId: string, principal: RequestPrincipal): Promise<FarmerScopeRow | null> {
  const result = await query<FarmerScopeRow>(
    `SELECT f.id, f.user_id, f.assigned_officer_id, f.region, f.tenant_id, f.is_active
     FROM farmers f
     WHERE f.id = $1`,
    [farmerId]
  );
  const farmer = result.rows[0];
  if (!farmer || !(await isTenantMember(farmer, principal))) return null;
  return (await hasRoleAccess(farmer, principal)) ? farmer : null;
}

export async function auditDataAction(
  principal: RequestPrincipal,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO analytics_events (event_type, user_id, metadata, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [action, principal.userId, JSON.stringify({ ...metadata, governance: true })]
    );
  } catch (error) {
    logger.error(`Data governance audit failed for ${action}:`, error);
    throw error;
  }
}

export async function getPrincipalTenantId(userId: string): Promise<string | null> {
  const result = await query<{ tenant_id: string | null }>(
    'SELECT tenant_id FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  return result.rows[0]?.tenant_id ?? null;
}

export function principalFromRequest(user: RequestPrincipal | undefined): RequestPrincipal | null {
  if (!user?.userId || !user.role) return null;
  return user;
}
