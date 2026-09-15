/**
 * Multi-tenant federation.
 *
 * Tenant configuration is read from the `tenants` table (branding/settings live in its
 * `capabilities` JSON column) and written through `upsertTenant`. A small reference
 * registry is used only when the table is empty (fresh install / prototype sandbox);
 * every response that can fall back to it carries `demoData` provenance so callers
 * never mistake reference data for a real tenant record.
 *
 * The advisory compliance gate FAILS CLOSED: an unknown tenant cannot be checked, so
 * the advisory is blocked rather than allowed.
 */
import { logger } from '../utils/logger';
import { query } from './databaseService';

export interface TenantBranding {
  logoUrl: string;
  primaryColorHex: string;
  accentColorHex: string;
  appName: string;
  /** Operator support line. Empty when the tenant has not provisioned one. */
  supportPhone: string;
}

export interface TenantAdvisoryRule {
  crop: string;
  mandatoryCheck: string;
  chemicalRestrictions?: string[];
}

export interface TenantSettings {
  defaultLanguage: 'sw' | 'en' | 'fr' | 'am' | 'ki' | 'luo';
  enforceMfa: boolean;
  customAdvisoryRules: TenantAdvisoryRule[];
}

export interface AgribusinessTenant {
  id: string;
  name: string;
  slug: string;
  category: 'cooperative_union' | 'commodity_exporter' | 'government_ministry' | 'seed_company';
  country: string;
  branding: TenantBranding;
  settings: TenantSettings;
}

export interface CooperativeHub {
  id: string;
  tenantId: string;
  regionId: string;
  name: string;
  code: string;
  location: { lat: number; lng: number };
  managerName: string;
  assignedOfficerIds: string[];
  registeredFarmerCount: number;
}

/**
 * Reference tenants for an empty `tenants` table. Illustrative structure only — no
 * dialable contact numbers are stored here.
 */
const REFERENCE_TENANTS: AgribusinessTenant[] = [
  {
    id: 'tenant-eagf-01',
    name: 'East Africa Grain Farmers Federation',
    slug: 'eagf',
    category: 'cooperative_union',
    country: 'Kenya',
    branding: {
      logoUrl: '/branding/eagf_logo.png',
      primaryColorHex: '#10B981',
      accentColorHex: '#F59E0B',
      appName: 'EAGF Decision Hub',
      supportPhone: '',
    },
    settings: {
      defaultLanguage: 'sw',
      enforceMfa: true,
      customAdvisoryRules: [
        {
          crop: 'Maize',
          mandatoryCheck: 'Aflatoxin moisture check prior to delivery (< 13.5%)',
          chemicalRestrictions: ['Carbofuran', 'Monocrotophos'],
        },
      ],
    },
  },
  {
    id: 'tenant-ktda-02',
    name: 'Highlands Smallholder Tea Agency',
    slug: 'hsta',
    category: 'commodity_exporter',
    country: 'Kenya',
    branding: {
      logoUrl: '/branding/hsta_logo.png',
      primaryColorHex: '#047857',
      accentColorHex: '#10B981',
      appName: 'HSTA Field Portal',
      supportPhone: '',
    },
    settings: {
      defaultLanguage: 'en',
      enforceMfa: true,
      customAdvisoryRules: [
        {
          crop: 'Tea',
          mandatoryCheck: 'Two leaves and a bud plucking standard',
          chemicalRestrictions: ['Glyphosate in active plucking fields'],
        },
      ],
    },
  },
];

interface TenantRow {
  id: string;
  name: string;
  region: string | null;
  default_language: string | null;
  capabilities: unknown;
}

interface TenantCapabilities {
  slug?: string;
  category?: AgribusinessTenant['category'];
  country?: string;
  branding?: Partial<TenantBranding>;
  settings?: Partial<TenantSettings>;
}

const DEFAULT_BRANDING: TenantBranding = {
  logoUrl: '',
  primaryColorHex: '#10B981',
  accentColorHex: '#F59E0B',
  appName: '',
  supportPhone: '',
};

function mapRowToTenant(row: TenantRow): AgribusinessTenant {
  const caps = (row.capabilities && typeof row.capabilities === 'object'
    ? row.capabilities
    : {}) as TenantCapabilities;
  const settings = caps.settings ?? {};
  const defaultLanguage = (settings.defaultLanguage ?? row.default_language ?? 'en') as TenantSettings['defaultLanguage'];

  return {
    id: row.id,
    name: row.name,
    slug: caps.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: caps.category || 'cooperative_union',
    country: caps.country || row.region || '',
    branding: { ...DEFAULT_BRANDING, ...(caps.branding ?? {}) },
    settings: {
      defaultLanguage,
      enforceMfa: settings.enforceMfa ?? true,
      customAdvisoryRules: settings.customAdvisoryRules ?? [],
    },
  };
}

interface TenantRegistry {
  tenants: AgribusinessTenant[];
  /** True when the list came from the built-in reference registry, not the database. */
  demoData: boolean;
  source: 'database' | 'reference_registry';
}

async function loadTenantRegistry(): Promise<TenantRegistry> {
  try {
    const { rows } = await query<TenantRow>(
      `SELECT id, name, region, default_language, capabilities FROM tenants`
    );
    if (rows.length === 0) {
      return { tenants: REFERENCE_TENANTS, demoData: true, source: 'reference_registry' };
    }
    return { tenants: rows.map(mapRowToTenant), demoData: false, source: 'database' };
  } catch (error) {
    logger.error('Failed to load tenants — falling back to the reference registry:', error);
    return { tenants: REFERENCE_TENANTS, demoData: true, source: 'reference_registry' };
  }
}

export async function listTenants(): Promise<TenantRegistry> {
  return loadTenantRegistry();
}

export async function getTenantBySlug(slug: string): Promise<AgribusinessTenant | null> {
  const cleanSlug = slug.toLowerCase().trim();
  const registry = await loadTenantRegistry();
  return registry.tenants.find(t => t.slug === cleanSlug) ?? null;
}

export async function getTenantById(tenantId: string): Promise<AgribusinessTenant | null> {
  const registry = await loadTenantRegistry();
  return registry.tenants.find(t => t.id === tenantId) ?? null;
}

/**
 * Resolve the tenant a principal is allowed to act for.
 *
 * Admins may act for any tenant. Every other role is bound to their own
 * `tenant_memberships` record; a principal with no membership resolves to null and
 * callers must deny (fail closed) rather than trusting a client-supplied tenant id.
 */
export async function resolveCallerTenantId(userId: string, role: string): Promise<string | null> {
  if (role === 'admin') return null; // null here means "unrestricted", see assertTenantAccess
  try {
    const { rows } = await query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenant_memberships WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );
    return rows[0]?.tenant_id ?? null;
  } catch (error) {
    logger.error('Failed to resolve caller tenant membership:', error);
    return null;
  }
}

/**
 * Authorize access to a specific tenant. `null` tenantId means "the caller's own
 * tenant" (resolved from membership). Throws-free: returns a discriminated result so
 * routes can shape the response.
 */
export async function assertTenantAccess(
  userId: string,
  role: string,
  requestedTenantId: string | null
): Promise<{ allowed: boolean; tenantId: string | null; reason?: string }> {
  if (role === 'admin') {
    return { allowed: true, tenantId: requestedTenantId };
  }

  const membershipTenantId = await resolveCallerTenantId(userId, role);

  if (!requestedTenantId) {
    if (!membershipTenantId) {
      return { allowed: false, tenantId: null, reason: 'Your account is not linked to an organization.' };
    }
    return { allowed: true, tenantId: membershipTenantId };
  }

  if (requestedTenantId !== membershipTenantId) {
    return {
      allowed: false,
      tenantId: membershipTenantId,
      reason: 'You can only act for your own organization.',
    };
  }
  return { allowed: true, tenantId: membershipTenantId };
}

export function buildTenantScopedQueryFilter(tenantId: string): {
  clause: string;
  param: string;
} {
  return {
    clause: 'organization_id = $1',
    param: tenantId,
  };
}

export interface ComplianceResult {
  isCompliant: boolean;
  /** False when the tenant id did not resolve — the check could not be performed. */
  tenantKnown: boolean;
  violatedRestrictions: string[];
  reason?: string;
}

/**
 * Validate a proposed chemical list against a tenant's advisory restrictions.
 *
 * FAILS CLOSED: if the tenant cannot be resolved the advisory is rejected, because a
 * banned-chemical check that cannot run must not silently pass.
 */
export async function validateTenantAdvisoryCompliance(
  tenantId: string,
  crop: string,
  proposedChemicals: string[]
): Promise<ComplianceResult> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    logger.warn(`Advisory compliance blocked: tenant ${tenantId} is unknown (fail-closed)`);
    return {
      isCompliant: false,
      tenantKnown: false,
      violatedRestrictions: [],
      reason: `Unknown tenant "${tenantId}" — advisory blocked pending tenant verification.`,
    };
  }

  const cropRule = tenant.settings.customAdvisoryRules.find(
    r => r.crop.toLowerCase() === crop.toLowerCase()
  );

  if (!cropRule || !cropRule.chemicalRestrictions || cropRule.chemicalRestrictions.length === 0) {
    return { isCompliant: true, tenantKnown: true, violatedRestrictions: [] };
  }

  const violations = proposedChemicals.filter(chem =>
    cropRule.chemicalRestrictions!.some(r => r.toLowerCase() === chem.toLowerCase())
  );

  if (violations.length > 0) {
    logger.warn(`Tenant ${tenantId} advisory compliance rejected for banned chemicals: ${violations.join(', ')}`);
  }

  return {
    isCompliant: violations.length === 0,
    tenantKnown: true,
    violatedRestrictions: violations,
  };
}

export interface UpsertTenantInput {
  id?: string;
  name: string;
  slug: string;
  category: AgribusinessTenant['category'];
  country: string;
  branding: TenantBranding;
  settings: TenantSettings;
}

/** Create or update a tenant record (branding/settings persist in `capabilities`). */
export async function upsertTenant(input: UpsertTenantInput): Promise<AgribusinessTenant> {
  const capabilities: TenantCapabilities = {
    slug: input.slug,
    category: input.category,
    country: input.country,
    branding: input.branding,
    settings: input.settings,
  };

  const { rows } = await query<TenantRow>(
    `INSERT INTO tenants (name, region, default_language, capabilities)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, name, region, default_language, capabilities`,
    [input.name, input.country, input.settings.defaultLanguage, JSON.stringify(capabilities)]
  );

  return mapRowToTenant(rows[0]);
}

/** Update an existing tenant's branding/settings by id. */
export async function updateTenant(
  tenantId: string,
  patch: Partial<Omit<UpsertTenantInput, 'id'>>
): Promise<AgribusinessTenant | null> {
  const existing = await getTenantById(tenantId);
  if (!existing) return null;

  const merged: UpsertTenantInput = {
    id: tenantId,
    name: patch.name ?? existing.name,
    slug: patch.slug ?? existing.slug,
    category: patch.category ?? existing.category,
    country: patch.country ?? existing.country,
    branding: { ...existing.branding, ...(patch.branding ?? {}) },
    settings: { ...existing.settings, ...(patch.settings ?? {}) },
  };

  const capabilities: TenantCapabilities = {
    slug: merged.slug,
    category: merged.category,
    country: merged.country,
    branding: merged.branding,
    settings: merged.settings,
  };

  const { rows } = await query<TenantRow>(
    `UPDATE tenants
        SET name = $2,
            region = $3,
            default_language = $4,
            capabilities = $5::jsonb,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, region, default_language, capabilities`,
    [tenantId, merged.name, merged.country, merged.settings.defaultLanguage, JSON.stringify(capabilities)]
  );

  return rows[0] ? mapRowToTenant(rows[0]) : null;
}
