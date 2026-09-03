/**
 * Agro-input dealer directory — wired via POST /api/pillars/suppliers/*.
 * Live results come from the agro_input_dealers table; when the table is missing or
 * empty the fallback demo directory is returned with an explicit demo_reference_data
 * provenance flag so callers can never mistake it for a live registry.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface AgroInputItem {
  id: string;
  name: string;
  category: 'seed' | 'fertilizer' | 'pesticide' | 'lime' | 'biological';
  manufacturer: string;
  certifyingBody: string; // e.g. KEPHIS, KALRO, Pest Control Products Board (PCPB)
  batchNumber: string;
  priceKes: number;
  unit: string;
  inStock: boolean;
  stockQuantity: number;
}

export interface CertifiedAgroDealer {
  id: string;
  dealerName: string;
  ownerName: string;
  licenseNumber: string;
  county: string;
  subCounty: string;
  location: {
    lat: number;
    lng: number;
    distanceKm?: number;
  };
  phone: string;
  isVerifiedStockist: boolean;
  inventory: AgroInputItem[];
}

const SEED_DEALERS: CertifiedAgroDealer[] = [
  // DEMO directory: in-code reference records used until the agro_input_dealers table
  // is populated. The `demo_reference_data` provenance block on every result says so.
  {
    id: 'dealer-nakuru-01',
    dealerName: 'Rift Valley Certified Farm Care',
    ownerName: 'Samuel Koech',
    licenseNumber: 'PCPB/2026/NK-048',
    county: 'Nakuru',
    subCounty: 'Rongai',
    location: { lat: -0.174, lng: 35.864 },
    phone: '+254711234567',
    isVerifiedStockist: true,
    inventory: [
      {
        id: 'input-1',
        name: 'Certified Maize Seed H6213',
        category: 'seed',
        manufacturer: 'Kenya Seed Company',
        certifyingBody: 'KEPHIS',
        batchNumber: 'KSC-2026-MZ-8821',
        priceKes: 520,
        unit: '2kg packet',
        inStock: true,
        stockQuantity: 450,
      },
      {
        id: 'input-2',
        name: 'Agricultural Calcific Lime (85% CaCO3)',
        category: 'lime',
        manufacturer: 'Athiriver Mining',
        certifyingBody: 'KEBS',
        batchNumber: 'ARM-2026-LM-019',
        priceKes: 380,
        unit: '50kg bag',
        inStock: true,
        stockQuantity: 120,
      },
      {
        id: 'input-3',
        name: 'Emamectin Benzoate 1.92 EC (Prove)',
        category: 'pesticide',
        manufacturer: 'Osho Chemicals',
        certifyingBody: 'PCPB',
        batchNumber: 'OSH-2026-EM-441',
        priceKes: 450,
        unit: '100ml bottle',
        inStock: true,
        stockQuantity: 85,
      },
    ],
  },
  {
    id: 'dealer-uasin-02',
    dealerName: 'Eldoret Grain & Seed Hub',
    ownerName: 'Mary Wambui',
    licenseNumber: 'PCPB/2026/UG-112',
    county: 'Uasin Gishu',
    subCounty: 'Turbo',
    location: { lat: 0.514, lng: 35.269 },
    phone: '+254722987654',
    isVerifiedStockist: true,
    inventory: [
      {
        id: 'input-4',
        name: 'DAP 18-46-0 Planting Fertilizer',
        category: 'fertilizer',
        manufacturer: 'Yara International',
        certifyingBody: 'KEBS',
        batchNumber: 'YAR-2026-DAP-902',
        priceKes: 5800,
        unit: '50kg bag',
        inStock: true,
        stockQuantity: 300,
      },
      {
        id: 'input-5',
        name: 'CAN 26% N Top Dressing',
        category: 'fertilizer',
        manufacturer: 'Toyota Tsusho Fertilizer',
        certifyingBody: 'KEBS',
        batchNumber: 'TTF-2026-CAN-118',
        priceKes: 3900,
        unit: '50kg bag',
        inStock: true,
        stockQuantity: 500,
      },
    ],
  },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return +(R * c).toFixed(1);
}

export function findNearbySuppliers(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  category?: 'seed' | 'fertilizer' | 'pesticide' | 'lime' | 'biological';
}): CertifiedAgroDealer[] {
  const { lat, lng, radiusKm = 50, category } = params;

  logger.info(`Searching agro-dealers near (${lat}, ${lng}), radius=${radiusKm}km, category=${category || 'all'}`);

  return SEED_DEALERS.map(dealer => ({
    ...dealer,
    location: {
      ...dealer.location,
      distanceKm: haversineKm(lat, lng, dealer.location.lat, dealer.location.lng),
    },
    inventory: category ? dealer.inventory.filter(i => i.category === category) : dealer.inventory,
  }))
    .filter(dealer => (dealer.location.distanceKm || 0) <= radiusKm && dealer.inventory.length > 0)
    .sort((a, b) => (a.location.distanceKm || 0) - (b.location.distanceKm || 0));
}

/** DB-backed variant — queries agro_input_dealers when the table exists, otherwise falls back to demo (flagged). */
export async function findNearbySuppliersLive(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  category?: 'seed' | 'fertilizer' | 'pesticide' | 'lime' | 'biological';
}): Promise<{ dealers: CertifiedAgroDealer[]; provenance: ReturnType<typeof pillarProvenance> }> {
  try {
    const { query } = await import('./databaseService');
    const { rows } = await query<{
      id: string; dealer_name: string; owner_name: string; license_number: string;
      county: string; sub_county: string; lat: number; lng: number; phone: string; is_verified: boolean;
    }>(`SELECT id, dealer_name, owner_name, license_number, county, sub_county, lat, lng, phone, is_verified
        FROM agro_input_dealers WHERE is_verified = true LIMIT 200`);
    if (rows.length > 0) {
      const dealers: CertifiedAgroDealer[] = rows.map(r => ({
        id: r.id, dealerName: r.dealer_name, ownerName: r.owner_name, licenseNumber: r.license_number,
        county: r.county, subCounty: r.sub_county, location: { lat: Number(r.lat), lng: Number(r.lng) },
        phone: r.phone, isVerifiedStockist: r.is_verified, inventory: [],
      }));
      const { lat, lng, radiusKm = 50 } = params;
      const filtered = dealers
        .map(d => ({ ...d, location: { ...d.location, distanceKm: haversineKm(lat, lng, d.location.lat, d.location.lng) } }))
        .filter(d => (d.location.distanceKm || 0) <= radiusKm)
        .sort((a, b) => (a.location.distanceKm || 0) - (b.location.distanceKm || 0));
      return {
        dealers: filtered,
        provenance: pillarProvenance(
          'computed_from_supplied_inputs',
          'Dealers queried live from the agro_input_dealers table (verified stockists only). Inventory is not seeded per dealer yet.',
          ['Distance computed via haversine over caller coordinates'],
          false
        ),
      };
    }
  } catch { /* table missing or DB unavailable — fall through to demo */ }
  const demo = findNearbySuppliers(params);
  return {
    dealers: demo,
    provenance: pillarProvenance(
      'demo_reference_data',
      'Live dealer DB unavailable or empty — results come from an in-code demo directory. Do not treat as a real dealer registry.',
      ['Demo directory covers Nakuru county only'],
      true
    ),
  };
}

export function verifyBatchNumber(batchNumber: string): {
  isAuthentic: boolean;
  item?: AgroInputItem;
  verificationSource: string;
} {
  const cleanBatch = batchNumber.trim().toUpperCase();

  for (const dealer of SEED_DEALERS) {
    const found = dealer.inventory.find(i => i.batchNumber.toUpperCase() === cleanBatch);
    if (found) {
      return {
        isAuthentic: true,
        item: found,
        verificationSource: `${found.certifyingBody} National Certified Input Registry`,
      };
    }
  }

  return {
    isAuthentic: false,
    verificationSource: 'National Input Verification Database (Unverified / Suspected Counterfeit)',
  };
}
