import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

/**
 * Resolves which regional manager owns a self-registered extension officer.
 *
 * The signup form offers country + region strings from the shared country list
 * ("Central Region (Lilongwe)"), while regional manager accounts store the
 * region they administer in whatever shape they were created with
 * ("Lilongwe"). The exact match runs first; the normalised contains-match
 * bridges that vocabulary gap. No match is a normal outcome: the account is
 * created and an administrator links it later.
 */
export type ManagerMatchKind = 'exact' | 'normalized' | 'none';

export interface ManagerResolution {
    managerId: string | null;
    matchedBy: ManagerMatchKind;
}

interface RegionalManagerRow {
    id: string;
    region: string | null;
    country: string | null;
}

const NO_MATCH: ManagerResolution = { managerId: null, matchedBy: 'none' };

/** Lowercase, punctuation-free, single-spaced form used for region comparison. */
function normalizeRegion(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Real accounts only: demo managers are excluded so a real officer is never
 * bound to a seeded demo account, and inactive managers never receive new staff.
 * A manager with no country recorded is still a candidate (legacy rows).
 */
async function loadCandidateManagers(country: string | null): Promise<RegionalManagerRow[]> {
    const result = await query(
        `SELECT id, region, country
           FROM users
          WHERE role = 'regional_manager'
            AND COALESCE(is_active, true) = true
            AND COALESCE(is_demo, false) = false
            AND ($1::text IS NULL OR COALESCE(country, '') = '' OR LOWER(country) = LOWER($1))
          ORDER BY created_at ASC NULLS LAST, id ASC`,
        [country]
    );
    return result.rows as RegionalManagerRow[];
}

/** Pure ranking step, separated from the lookup so it can be tested directly. */
export function resolveManagerFromCandidates(
    region: string | null,
    candidates: RegionalManagerRow[]
): ManagerResolution {
    const target = region ? normalizeRegion(region) : '';
    if (!target) return NO_MATCH;

    const exact = candidates.find(
        candidate => candidate.region !== null && normalizeRegion(candidate.region) === target
    );
    if (exact) return { managerId: exact.id, matchedBy: 'exact' };

    const contained = candidates.find(candidate => {
        if (!candidate.region) return false;
        const normalized = normalizeRegion(candidate.region);
        // Two-character fragments match too much to be a useful signal.
        if (normalized.length <= 2) return false;
        return target.includes(normalized) || normalized.includes(target);
    });
    if (contained) return { managerId: contained.id, matchedBy: 'normalized' };

    return NO_MATCH;
}

export async function resolveRegionalManager(
    region: string | null,
    country: string | null
): Promise<ManagerResolution> {
    if (!region?.trim()) return NO_MATCH;

    try {
        const candidates = await loadCandidateManagers(country?.trim() || null);
        return resolveManagerFromCandidates(region, candidates);
    } catch (error) {
        // Never block a signup on directory lookup: log and let an administrator link the account.
        logger.warn(
            `Regional manager lookup failed for region "${region}": ${error instanceof Error ? error.message : 'unknown error'}`
        );
        return NO_MATCH;
    }
}
