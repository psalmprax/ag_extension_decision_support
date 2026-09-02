/**
 * @deprecated Specification phase only — not wired to any API surface (route, tool, worker, or app.ts).
 * See docs/PILLAR_SERVICES_DECISION.md for details.
 * These services exist only in test files and have no production integration.
 */
import { logger } from '../utils/logger';

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
