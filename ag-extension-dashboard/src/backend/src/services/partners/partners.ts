/**
 * Content partners and who may use their libraries. The system administrator adds a
 * partner and grants organisations access; everyone else sees only the partners granted
 * to their own organisation.
 */
import { query } from '@/services/databaseService';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

export class PartnerError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}

export interface Principal { userId: string; role: string; isDemo?: boolean }

export interface PartnerRow {
    id: string;
    name: string;
    website: string | null;
    contact_email: string | null;
    notes: string | null;
    created_at: string;
    recordings: string;
    approved: string;
    tenants: string[] | null;
}

export interface PartnerInput { name: string; website?: string | null; contactEmail?: string | null; notes?: string | null }

/**
 * SQL limiting partners `p` to those this person may use: every partner for the system
 * administrator, otherwise those granted to their organisation. Parameters from `$first`.
 */
export async function partnerScope(principal: Principal, first: number): Promise<{ sql: string; params: unknown[] }> {
    if (principal.role === 'admin') return { sql: 'TRUE', params: [] };
    const tenantId = await getPrincipalTenantId(principal.userId);
    if (!tenantId) return { sql: 'FALSE', params: [] };
    return {
        sql: `EXISTS (SELECT 1 FROM content_partner_grants g WHERE g.partner_id = p.id AND g.tenant_id = $${first})`,
        params: [tenantId],
    };
}

export async function listPartners(principal: Principal): Promise<PartnerRow[]> {
    const scope = await partnerScope(principal, 1);
    const { rows } = await query<PartnerRow>(
        `SELECT p.id, p.name, p.website, p.contact_email, p.notes, p.created_at,
                (SELECT COUNT(*) FROM partner_recordings r WHERE r.partner_id = p.id)::text AS recordings,
                (SELECT COUNT(*) FROM partner_recordings r WHERE r.partner_id = p.id AND r.review_status = 'approved')::text AS approved,
                (SELECT array_agg(t.name ORDER BY t.name) FROM content_partner_grants g JOIN tenants t ON t.id = g.tenant_id WHERE g.partner_id = p.id) AS tenants
           FROM content_partners p
          WHERE ${scope.sql}
          ORDER BY p.name`,
        scope.params,
    );
    return rows;
}

export async function createPartner(adminId: string, input: PartnerInput): Promise<{ id: string }> {
    const name = input.name.trim();
    if (!name) throw new PartnerError('Give the partner a name');
    const { rows } = await query<{ id: string }>(
        `INSERT INTO content_partners (name, website, contact_email, notes, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [name, input.website ?? null, input.contactEmail ?? null, input.notes ?? null, adminId],
    );
    if (!rows[0]) throw new PartnerError('A partner with this name already exists', 409);
    return rows[0];
}

/** Every organisation, for the administrator choosing who may use a library. */
export async function listOrganisations(): Promise<Array<{ id: string; name: string }>> {
    const { rows } = await query<{ id: string; name: string }>('SELECT id, name FROM tenants ORDER BY name');
    return rows;
}

/** Let an organisation use (or stop using) a partner's library. */
export async function setGrant(adminId: string, partnerId: string, tenantId: string, granted: boolean): Promise<void> {
    if (granted) {
        const { rowCount } = await query(
            `INSERT INTO content_partner_grants (partner_id, tenant_id, granted_by)
             SELECT p.id, t.id, $3 FROM content_partners p, tenants t WHERE p.id = $1 AND t.id = $2
             ON CONFLICT DO NOTHING`,
            [partnerId, tenantId, adminId],
        );
        if (rowCount === 0) {
            const { rows } = await query('SELECT 1 FROM content_partner_grants WHERE partner_id = $1 AND tenant_id = $2', [partnerId, tenantId]);
            if (!rows[0]) throw new PartnerError('Partner or organisation not found', 404);
        }
        return;
    }
    await query('DELETE FROM content_partner_grants WHERE partner_id = $1 AND tenant_id = $2', [partnerId, tenantId]);
}
