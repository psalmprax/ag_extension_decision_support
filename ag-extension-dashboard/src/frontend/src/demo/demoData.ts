/**
 * Centralized demo datasets + derived builders.
 *
 * All synthetic demo data lives here (single source of truth). Demo data is
 * rendered client-side only — it is never sent to the live API; the request
 * interceptor in `client.ts` enforces that at the network boundary.
 */
import type { Farmer } from '@/store/useAppStore';
import type { Visit } from '@/types/dashboard';
import type { Report, Field, CropCycle } from '@ag-extension/shared/api';

export interface DemoFarmerExtended extends Farmer {
  lat: number;
  lng: number;
  crop: string;
  size: number;
  yield?: number;
  status?: 'healthy' | 'warning' | 'critical';
  soilType?: string;
  lastVisitDate?: string;
}

export const DEMO_FARMERS: (Farmer & {
  latitude: number;
  longitude: number;
  crops: string[];
  farmSize: number;
  yield: number;
})[] = [
  {
    id: 'demo-farmer-1',
    firstName: 'Emmanuel',
    lastName: 'Mwangi',
    location: 'Machakos Rural, Eastern Zone',
    region: 'Machakos',
    village: 'Kathiani',
    phone: '+254712345601',
    languagePreference: 'en',
    crops: ['Maize', 'Beans'],
    farmSize: 3.5,
    latitude: -1.5177,
    longitude: 37.2634,
    yield: 4.2,
  },
  {
    id: 'demo-farmer-2',
    firstName: 'Grace',
    lastName: 'Wanjiku',
    location: 'Kiambu Highlands',
    region: 'Kiambu',
    village: 'Githunguri',
    phone: '+254712345602',
    languagePreference: 'en',
    crops: ['Coffee', 'Maize'],
    farmSize: 2.2,
    latitude: -1.05,
    longitude: 36.85,
    yield: 5.8,
  },
  {
    id: 'demo-farmer-3',
    firstName: 'David',
    lastName: 'Kiprono',
    location: 'Rift Valley Basin, Nakuru',
    region: 'Nakuru',
    village: 'Njoro',
    phone: '+254712345603',
    languagePreference: 'en',
    crops: ['Potatoes', 'Wheat'],
    farmSize: 5.0,
    latitude: -0.3031,
    longitude: 36.08,
    yield: 8.4,
  },
  {
    id: 'demo-farmer-4',
    firstName: 'Amina',
    lastName: 'Hassan',
    location: 'Kilifi Coastal Strip',
    region: 'Kilifi',
    village: 'Malindi Sub-County',
    phone: '+254712345604',
    languagePreference: 'sw',
    crops: ['Cassava', 'Cashew'],
    farmSize: 4.1,
    latitude: -3.22,
    longitude: 40.1167,
    yield: 6.1,
  },
  {
    id: 'demo-farmer-5',
    firstName: 'Samuel',
    lastName: 'Otieno',
    location: 'Lake Basin, Kisumu',
    region: 'Kisumu',
    village: 'Kano Plains',
    phone: '+254712345605',
    languagePreference: 'luo',
    crops: ['Rice', 'Sorghum'],
    farmSize: 1.8,
    latitude: -0.0917,
    longitude: 34.768,
    yield: 3.9,
  },
  {
    id: 'demo-farmer-6',
    firstName: 'Faith',
    lastName: 'Chebet',
    location: 'Eldoret North Grain Belt',
    region: 'Uasin Gishu',
    village: 'Turbo',
    phone: '+254712345606',
    languagePreference: 'kal',
    crops: ['Maize', 'Soybeans'],
    farmSize: 6.5,
    latitude: 0.5143,
    longitude: 35.2698,
    yield: 9.2,
  },
  {
    id: 'demo-farmer-7',
    firstName: 'Joseph',
    lastName: 'Mutua',
    location: 'Meru Eastern Slopes',
    region: 'Meru',
    village: 'Timau',
    phone: '+254712345607',
    languagePreference: 'en',
    crops: ['Tea', 'Avocado'],
    farmSize: 2.8,
    latitude: 0.05,
    longitude: 37.65,
    yield: 7.5,
  },
  {
    id: 'demo-farmer-8',
    firstName: 'Esther',
    lastName: 'Nyambura',
    location: 'Nyeri Hillside Agro-Forest',
    region: 'Nyeri',
    village: 'Othaya',
    phone: '+254712345608',
    languagePreference: 'en',
    crops: ['Coffee', 'Macadamia'],
    farmSize: 1.5,
    latitude: -0.4167,
    longitude: 36.95,
    yield: 4.8,
  },
  {
    id: 'demo-farmer-9',
    firstName: 'Brian',
    lastName: 'Wekesa',
    location: 'Trans Nzoia Valley',
    region: 'Kitale',
    village: 'Endebess',
    phone: '+254712345609',
    languagePreference: 'en',
    crops: ['Maize', 'Sunflower'],
    farmSize: 8.0,
    latitude: 1.0167,
    longitude: 35.0,
    yield: 11.0,
  },
  {
    id: 'demo-farmer-10',
    firstName: 'Lydia',
    lastName: 'Moraa',
    location: 'Kisii Highland Terraces',
    region: 'Kisii',
    village: 'Suneka',
    phone: '+254712345610',
    languagePreference: 'en',
    crops: ['Bananas', 'Tea'],
    farmSize: 1.2,
    latitude: -0.6817,
    longitude: 34.7667,
    yield: 5.1,
  },
  {
    id: 'demo-farmer-11',
    firstName: 'Peter',
    lastName: 'Maina',
    location: 'Muranga Agro Zone',
    region: 'Muranga',
    village: 'Kangema',
    phone: '+254712345611',
    languagePreference: 'en',
    crops: ['Avocado', 'Coffee'],
    farmSize: 3.0,
    latitude: -0.7167,
    longitude: 37.15,
    yield: 6.8,
  },
  {
    id: 'demo-farmer-12',
    firstName: 'Beatrice',
    lastName: 'Cherotich',
    location: 'Bomet South Escarpment',
    region: 'Bomet',
    village: 'Sotik',
    phone: '+254712345612',
    languagePreference: 'kal',
    crops: ['Tea', 'Dairy Pasture'],
    farmSize: 4.5,
    latitude: -0.7813,
    longitude: 35.3416,
    yield: 7.2,
  },
];

/** Demo visits so search + lists render without live API calls. */
export const DEMO_VISITS: Visit[] = [
  {
    id: 'demo-v1',
    farmer_id: 'demo-farmer-1',
    farmer_name: `${DEMO_FARMERS[0].firstName} ${DEMO_FARMERS[0].lastName}`,
    scheduled_at: new Date().toISOString(),
    visit_type: 'follow-up',
    status: 'pending',
  },
];

/** Demo reports so search renders without live API calls. */
export const DEMO_REPORTS: Report[] = [
  {
    id: 'demo-r1',
    title: 'Demo Region Overview',
    type: 'activity_report',
    generatedAt: new Date().toISOString(),
    status: 'completed',
    data: {},
  },
];

/** Static demo fields for a farmer (demo ids never exist in the live DB). */
export function buildDemoFields(farmerId: string, withCycles = true): Field[] {
  return [
    {
      id: 'field-demo-1',
      farmerId: farmerId || 'demo-farmer-1',
      name: 'Machakos Maize Sector A',
      areaHectares: 4.5,
      soilType: 'loam',
      soilPh: 6.5,
      latitude: -1.5177,
      longitude: 37.2634,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cropCycles: withCycles
        ? [
            {
              id: 'cycle-1',
              fieldId: 'field-demo-1',
              cropName: 'Maize',
              variety: 'SC 719',
              status: 'growing',
              plantingDate: '2026-11-15',
              expectedHarvestDate: '2026-04-10',
              yieldKg: 3500,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } satisfies CropCycle,
          ]
        : [],
    },
  ];
}

// --- Dashboard aggregation builders (derived from the demo dataset) ---------

function sumFarmerNumeric(farmers: Farmer[], pick: (f: Farmer) => number): number {
  return farmers.reduce((sum, f) => sum + (Number(pick(f)) || 0), 0);
}

function avgFarmerYield(farmers: Farmer[]): number {
  const total = farmers.length;
  const totalYield = sumFarmerNumeric(farmers, f => (f as Farmer & { yield?: number }).yield ?? 0);
  return total > 0 ? totalYield / total : 0;
}

export function buildCropDistribution(farmers: Farmer[]) {
  const counts = new Map<string, number>();
  farmers.forEach(farmer => {
    (farmer.crops || []).forEach(crop => {
      counts.set(crop, (counts.get(crop) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildRegionBreakdown(farmers: Farmer[]) {
  const counts = new Map<string, number>();
  farmers.forEach(farmer => {
    const region = farmer.region || 'Unknown';
    counts.set(region, (counts.get(region) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([region, count]) => ({ region, farmers: count }))
    .sort((a, b) => b.farmers - a.farmers);
}

export function buildDemoDashboardData(farmers: Farmer[]) {
  const totalFarmers = farmers.length;
  const totalHectares = sumFarmerNumeric(farmers, f => f.farmSize ?? 0);
  const avgYield = avgFarmerYield(farmers);
  const activeConversations = Math.max(1, Math.round(totalFarmers * 0.75));
  const visitsThisMonth = Math.max(1, Math.round(totalFarmers * 0.6));

  return {
    overview: {
      totalFarmers,
      totalHectares,
      avgYield: Math.round(avgYield * 10) / 10,
      activeConversations,
      visitsThisMonth,
      avgSatisfaction: 4.6,
      avgConversationsPerFarmer: Math.round((activeConversations / totalFarmers) * 10) / 10,
    },
    trends: {
      farmersGrowth: 4.2,
      conversationsGrowth: 6.1,
      visitsGrowth: 3.4,
      satisfactionChange: 0.2,
    },
    geography: buildRegionBreakdown(farmers),
    crops: buildCropDistribution(farmers),
  };
}

function demoResolutionRate(total: number): number {
  return total > 0 ? Math.round(((total - 1) / total) * 1000) / 10 : 92;
}

export function buildDemoPerformanceData(farmers: Farmer[]) {
  const total = farmers.length;
  return {
    metrics: {
      resolutionRate: demoResolutionRate(total),
      satisfactionScore: 4.6,
      avgResponseTime: '2.4m',
      followUpRate: 68,
      firstContactResolution: 74,
    },
    timeline: farmers.slice(0, 6).map((_f, i) => ({
      date: `Week ${i + 1}`,
      farmers: total,
    })),
  };
}

export interface DemoUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  region: string;
  phone: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'demo-user-1',
    firstName: 'Sarah',
    lastName: 'Kiprono',
    email: 'sarah.officer@agridemo.com',
    role: 'extension_officer',
    region: 'Nakuru',
    phone: '+254712000001',
  },
  {
    id: 'demo-user-2',
    firstName: 'David',
    lastName: 'Ochieng',
    email: 'david.admin@agridemo.com',
    role: 'admin',
    region: 'Nairobi HQ',
    phone: '+254712000002',
  },
  {
    id: 'demo-user-3',
    firstName: 'Amina',
    lastName: 'Hassan',
    email: 'amina.manager@agridemo.com',
    role: 'regional_manager',
    region: 'Eastern Zone',
    phone: '+254712000003',
  },
  {
    id: 'demo-user-4',
    firstName: 'Emmanuel',
    lastName: 'Mwangi',
    email: 'emmanuel.farmer@agridemo.com',
    role: 'farmer',
    region: 'Machakos',
    phone: '+254712345601',
  },
];

export const DEMO_ACTIVITIES = [
  {
    id: 'demo-act-1',
    farmerName: 'Emmanuel Mwangi',
    phone: '+254 712 345601',
    channel: 'USSD' as const,
    language: 'SW' as const,
    severityScore: 88,
    crop: 'Potatoes / Tomatoes',
    region: 'Machakos, Kenya',
    issue: 'Late Blight (Phytophthora infestans)',
    aiSummary: 'Water-soaked leaf lesions spreading rapidly after heavy rain. High spore germination risk.',
    timestamp: '2m ago',
    isClaimed: false,
    journeySteps: [
      { label: 'USSD Dialed', dwellTime: '2m ago' },
      { label: 'Diagnosis Menu', dwellTime: '1m ago' },
      { label: 'Leaf Blight Query', dwellTime: 'Now', status: 'active' as const },
    ],
  },
  {
    id: 'demo-act-2',
    farmerName: 'Grace Wanjiku',
    phone: '+254 712 345602',
    channel: 'SMS' as const,
    language: 'EN' as const,
    severityScore: 74,
    crop: 'Maize',
    region: 'Kiambu Highlands, Kenya',
    issue: 'Fall Armyworm Infestation',
    aiSummary: 'Windowpaning on whorl leaves. Larvae detected in upper canopy. Recommends Emamectin benzoate.',
    timestamp: '7m ago',
    isClaimed: false,
    journeySteps: [
      { label: 'SMS Received', dwellTime: '7m ago' },
      { label: 'Pest AI Parser', dwellTime: '6m ago' },
      { label: 'Triage Queue', dwellTime: 'Now', status: 'active' as const },
    ],
  },
  {
    id: 'demo-act-3',
    farmerName: 'Kiplagat Ruto',
    phone: '+254 712 345603',
    channel: 'App' as const,
    language: 'EN' as const,
    severityScore: 42,
    crop: 'Wheat / Barley',
    region: 'Uasin Gishu, Kenya',
    issue: 'Stem Rust (Early Stage)',
    aiSummary: 'Isolated orange pustules under lower leaves. Recommended cultural pruning and preventative fungicide.',
    timestamp: '15m ago',
    isClaimed: false,
    journeySteps: [
      { label: 'Mobile App Opened', dwellTime: '15m ago' },
      { label: 'Field Sensor Sync', dwellTime: '12m ago' },
      { label: 'Advice Viewed', dwellTime: 'Now', status: 'active' as const },
    ],
  },
];

