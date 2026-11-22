import { query } from '@/services/databaseService';
import { demoSql, type DemoViewer } from '@/services/demoScope';
import { resolvePrincipalRegion } from '@/services/messageAccessService';
import { isUuid } from '@/utils/uuid';

export interface ScopePrincipal extends DemoViewer {
    userId: string;
    role: string;
    /** Demo sessions see only demo records; real accounts never see them. */
    isDemo?: boolean;
}

/**
 * The one rule for whose farmers a person may see, as SQL on the farmers table:
 * an administrator everyone, a regional manager their region, an officer the farmers
 * assigned to them, a farmer only themselves; anyone else no one. Demo records are
 * kept apart from real ones either way. Parameters are numbered from `firstParam`.
 *
 * Every list that returns farmer data (or rows that belong to farmers) filters with
 * this, so the rule cannot drift between pages. The access test in
 * tests-e2e/access/no-cross-region-data.spec.ts calls every list to prove it.
 */
export async function farmerScopeSql(
    principal: ScopePrincipal,
    alias = 'f',
    firstParam = 1,
): Promise<{ sql: string; params: unknown[] }> {
    const conditions = [demoSql(alias, principal)];
    const params: unknown[] = [];
    const next = (value: unknown) => {
        params.push(value);
        return `$${firstParam + params.length - 1}`;
    };
    switch (principal.role) {
        case 'admin':
            break;
        case 'regional_manager':
            // A manager with no region on record sees no farmers (NULL matches nothing).
            conditions.push(`${alias}.region = ${next(await resolvePrincipalRegion(principal.userId))}`);
            break;
        case 'extension_officer':
            conditions.push(`${alias}.assigned_officer_id = ${next(principal.userId)}`);
            break;
        case 'farmer':
            conditions.push(`${alias}.user_id = ${next(principal.userId)}`);
            break;
        default:
            conditions.push('FALSE');
    }
    return { sql: conditions.join(' AND '), params };
}

/** The same rule for a table that points at farmers through `farmerIdColumn` (visits, fields…). */
export async function rowsOfVisibleFarmersSql(
    principal: ScopePrincipal,
    farmerIdColumn: string,
    firstParam = 1,
): Promise<{ sql: string; params: unknown[] }> {
    const scope = await farmerScopeSql(principal, 'scope_f', firstParam);
    return {
        sql: `EXISTS (SELECT 1 FROM farmers scope_f WHERE scope_f.id = ${farmerIdColumn} AND ${scope.sql})`,
        params: scope.params,
    };
}

/**
 * The ids of the farmers a person may see, for code that filters with Prisma, or null
 * for an administrator (everyone, within the demo/real split already applied).
 */
export async function visibleFarmerIds(principal: ScopePrincipal): Promise<string[] | null> {
    if (principal.role === 'admin') return null;
    const scope = await farmerScopeSql(principal, 'f');
    const { rows } = await query<{ id: string }>(`SELECT f.id FROM farmers f WHERE ${scope.sql}`, scope.params);
    return rows.map(row => row.id);
}

/** Whether a person may see one farmer, by the same rule. */
export async function canSeeFarmer(principal: ScopePrincipal, farmerId: string): Promise<boolean> {
    const scope = await farmerScopeSql(principal, 'f', 2);
    const { rows } = await query(`SELECT 1 FROM farmers f WHERE f.id = $1 AND ${scope.sql} LIMIT 1`, [farmerId, ...scope.params]);
    return rows.length > 0;
}

/** The signed-in person on a request, as a scope principal, or null when nobody is signed in. */
export function principalOf(req: import('express').Request): ScopePrincipal | null {
    const user = req.user as { userId?: string; role?: string; isDemo?: boolean } | undefined;
    return user?.userId && user.role ? { userId: user.userId, role: user.role, isDemo: user.isDemo } : null;
}

/** Whether the signed-in person may see this farmer (and so the records that belong to them). */
export async function requestCanSeeFarmer(req: import('express').Request, farmerId: string | null | undefined): Promise<boolean> {
    const principal = principalOf(req);
    return Boolean(principal && farmerId && (await canSeeFarmer(principal, farmerId)));
}

/**
 * Express guard for routes about a record that belongs to a farmer (a crop cycle, a
 * milestone…): `farmerOfSql` takes the URL id as $1 and returns the owning farmer as
 * `farmer_id`. Answers 404 unless the signed-in person may see that farmer.
 */
export function requireRecordOfVisibleFarmer(param: string, farmerOfSql: string, notFound = 'Not found') {
    return async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
        if (!principalOf(req)) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const id = req.params[param];
        if (id && isUuid(id)) {
            const { rows } = await query<{ farmer_id: string | null }>(farmerOfSql, [id]);
            if (await requestCanSeeFarmer(req, rows[0]?.farmer_id)) {
                next();
                return;
            }
        }
        res.status(404).json({ success: false, error: notFound });
    };
}

/** SQL for `requireRecordOfVisibleFarmer`: the farmer a record belongs to, from its id. */
export const FARMER_OF = {
    cropCycle: `SELECT fl.farmer_id FROM crop_cycles c JOIN fields fl ON fl.id = c.field_id WHERE c.id = $1`,
    milestone: `SELECT fl.farmer_id FROM crop_cycle_milestones m
                JOIN crop_cycles c ON c.id = m.crop_cycle_id JOIN fields fl ON fl.id = c.field_id
                WHERE m.id = $1`,
} as const;

/**
 * Express guard for routes about one farmer (`:farmerId` or another param): answers 404
 * unless the signed-in person may see that farmer under the shared rule. 404, not 403,
 * so the answer does not confirm that a farmer exists in another region.
 */
export function requireFarmerAccess(param = 'farmerId') {
    return async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
        const principal = principalOf(req);
        const farmerId = req.params[param];
        if (!principal) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        try {
            if (farmerId && (await canSeeFarmer(principal, farmerId))) {
                next();
                return;
            }
        } catch {
            // An unreadable id (not a UUID) is simply not a farmer this person can see.
        }
        res.status(404).json({ success: false, error: 'Farmer not found' });
    };
}
