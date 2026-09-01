import { logger } from '../utils/logger';

export interface AgribusinessTenant {
  id: string;
  name: string;
  slug: string;
  category: 'cooperative_union' | 'commodity_exporter' | 'government_ministry' | 'seed_company';
  country: string;
  branding: {
    logoUrl: string;
    primaryColorHex: string;
    accentColorHex: string;
    appName: string;
    supportPhone: string;
  };
  settings: {
    defaultLanguage: 'sw' | 'en' | 'fr' | 'am' | 'ki' | 'luo';
    enforceMfa: boolean;
    customAdvisoryRules: Array<{
      crop: string;
      mandatoryCheck: string;
      chemicalRestrictions?: string[];
    }>;
  };
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

const REGISTERED_TENANTS: AgribusinessTenant[] = [
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
      supportPhone: '+254700000111',
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
      supportPhone: '+254700000222',
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

export function getTenantBySlug(slug: string): AgribusinessTenant | null {
  const cleanSlug = slug.toLowerCase().trim();
  const tenant = REGISTERED_TENANTS.find(t => t.slug === cleanSlug);
  return tenant || null;
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

export function validateTenantAdvisoryCompliance(
  tenantId: string,
  crop: string,
  proposedChemicals: string[]
): { isCompliant: boolean; violatedRestrictions: string[] } {
  const tenant = REGISTERED_TENANTS.find(t => t.id === tenantId);
  if (!tenant) return { isCompliant: true, violatedRestrictions: [] };

  const cropRule = tenant.settings.customAdvisoryRules.find(
    r => r.crop.toLowerCase() === crop.toLowerCase()
  );

  if (!cropRule || !cropRule.chemicalRestrictions) {
    return { isCompliant: true, violatedRestrictions: [] };
  }

  const violations: string[] = [];
  for (const chem of proposedChemicals) {
    if (cropRule.chemicalRestrictions.some(r => r.toLowerCase() === chem.toLowerCase())) {
      violations.push(chem);
    }
  }

  if (violations.length > 0) {
    logger.warn(`Tenant ${tenantId} advisory compliance rejected for banned chemicals: ${violations.join(', ')}`);
  }

  return {
    isCompliant: violations.length === 0,
    violatedRestrictions: violations,
  };
}
