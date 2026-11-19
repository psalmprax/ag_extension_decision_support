/**
 * Service access the system administrator grants to one account (for example a
 * Free farmer messaging their officer) without changing its plan.
 * A grant is active until it is revoked or its end date passes.
 */
import { query } from '@/services/databaseService';
import { PAID_SERVICES, type PaidService } from '@/services/paidServices';

export interface ServiceAccessDto {
  service: PaidService;
  label: string;
  grantedAt: string;
  expiresAt: string | null;
  grantedBy: string | null;
  note: string | null;
}

const active = (alias = '') => {
  const col = (name: string) => (alias ? `${alias}.${name}` : name);
  return `${col('revoked_at')} IS NULL AND (${col('expires_at')} IS NULL OR ${col('expires_at')} > NOW())`;
};
const ACTIVE = active();

interface GrantRow {
  service: PaidService;
  granted_at: Date;
  expires_at: Date | null;
  granted_by_name: string | null;
  note: string | null;
}

const toDto = (row: GrantRow): ServiceAccessDto => ({
  service: row.service,
  label: PAID_SERVICES[row.service]?.label ?? row.service,
  grantedAt: row.granted_at.toISOString(),
  expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
  grantedBy: row.granted_by_name,
  note: row.note,
});

/** The services an account may use beyond its plan right now. */
export async function activeServicesFor(userId: string): Promise<PaidService[]> {
  const res = await query<{ service: PaidService }>(`SELECT service FROM service_access_grants WHERE user_id = $1 AND ${ACTIVE} ORDER BY service`, [userId]);
  return res.rows.map(r => r.service);
}

export async function hasServiceAccess(userId: string, service: PaidService): Promise<boolean> {
  const res = await query(`SELECT 1 FROM service_access_grants WHERE user_id = $1 AND service = $2 AND ${ACTIVE}`, [userId, service]);
  return res.rows.length > 0;
}

export async function listServiceAccess(userId: string): Promise<ServiceAccessDto[]> {
  const res = await query<GrantRow>(
    `SELECT g.service, g.granted_at, g.expires_at, g.note,
            NULLIF(TRIM(CONCAT(a.first_name, ' ', a.last_name)), '') AS granted_by_name
       FROM service_access_grants g
       LEFT JOIN users a ON a.id = g.granted_by
      WHERE g.user_id = $1 AND ${active('g')}
      ORDER BY g.service`,
    [userId]
  );
  return res.rows.map(toDto);
}

/** Grants (or re-grants, replacing the end date and note) one service. */
export async function grantServiceAccess(params: {
  userId: string;
  service: PaidService;
  grantedBy: string;
  expiresAt: Date | null;
  note: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO service_access_grants (user_id, service, granted_by, granted_at, expires_at, note)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     ON CONFLICT (user_id, service) DO UPDATE
        SET granted_by = EXCLUDED.granted_by, granted_at = NOW(), expires_at = EXCLUDED.expires_at,
            note = EXCLUDED.note, revoked_at = NULL, revoked_by = NULL`,
    [params.userId, params.service, params.grantedBy, params.expiresAt, params.note]
  );
}

/** Revokes an active grant. Returns false when there was none. */
export async function revokeServiceAccess(userId: string, service: PaidService, revokedBy: string): Promise<boolean> {
  const res = await query(
    `UPDATE service_access_grants SET revoked_at = NOW(), revoked_by = $3
      WHERE user_id = $1 AND service = $2 AND ${ACTIVE}
      RETURNING id`,
    [userId, service, revokedBy]
  );
  return res.rows.length > 0;
}
