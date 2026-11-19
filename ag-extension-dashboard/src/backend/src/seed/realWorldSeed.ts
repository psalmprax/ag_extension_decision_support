/**
 * Real-world (non-demo) seed fixtures: two regional managers, one extension
 * officer each, and six farmers per officer.
 *
 * Deliberately separate from `prisma/demoFarmers.ts`, which mirrors the frontend
 * demo dataset 1:1 and must not change. These accounts are `is_demo = false`,
 * live on the RFC 2606 reserved `.test` TLD (so a stray verification mail can
 * never reach a real inbox), and share one known password so every role can
 * actually log in.
 *
 * Region strings are the exact values from the frontend `SUPPORTED_COUNTRIES`
 * list, so `regionalManagerResolver` matches them without its normalisation
 * fallback and the signup flow can be exercised end to end.
 */

/** RFC 2606 reserved TLD — no real mailbox can ever exist here. */
export const REAL_WORLD_EMAIL_DOMAIN = '@real.agriext.test';

/**
 * Tenant every real-world fixture belongs to. The scoping routes resolve a
 * principal tenant before filtering, so an account without one is refused.
 */
export const REAL_WORLD_TENANT_ID = 'e0000000-0000-4000-8000-000000000001';
export const REAL_WORLD_TENANT_NAME = 'Real-world extension fixtures';

/** Shared password for every seeded account. Satisfies the live password policy. */
export const REAL_WORLD_PASSWORD = 'Harvest2026!';

export interface RealWorldFarmerSeed {
    id: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    village: string;
    district: string;
    region: string;
    country: string;
    farmSizeHectares: number;
    crops: string[];
    vitalScore: number;
    soilMoisture: number;
    temperature: number;
    phLevel: number;
    aiConfidence: number;
    locationLat: number;
    locationLng: number;
    languagePreference: string;
}

export interface RealWorldAccountSeed {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    region: string;
    country: string;
}

export interface RealWorldRegionSeed {
    manager: RealWorldAccountSeed;
    officer: RealWorldAccountSeed;
    farmers: RealWorldFarmerSeed[];
}

/** Deterministic, plausible agronomic readings — no randomness, so reruns converge. */
function metrics(index: number) {
    return {
        soilMoisture: 38 + ((index * 3) % 14),
        temperature: 22 + (index % 6),
        phLevel: Math.round((5.6 + (index % 5) * 0.2) * 10) / 10,
        aiConfidence: 70 + ((index * 4) % 25),
    };
}

function farmer(
    index: number,
    detail: {
        firstName: string;
        lastName: string;
        village: string;
        district: string;
        region: string;
        country: string;
        farmSizeHectares: number;
        crops: string[];
        vitalScore: number;
        locationLat: number;
        locationLng: number;
        languagePreference: string;
    },
    idSuffix: string,
    phone: string,
    emailSlug: string
): RealWorldFarmerSeed {
    return {
        id: `e4000000-0000-4000-8000-${idSuffix}`,
        userId: `e3000000-0000-4000-8000-${idSuffix}`,
        email: `farmer.${emailSlug}${REAL_WORLD_EMAIL_DOMAIN}`,
        phone,
        ...detail,
        ...metrics(index),
    };
}

const KENYA_REGION = 'Rift Valley';
const MALAWI_REGION = 'Northern Region (Mzuzu)';

export const REAL_WORLD_REGIONS: RealWorldRegionSeed[] = [
    {
        manager: {
            id: 'e1000000-0000-4000-8000-000000000001',
            email: `rm.nakuru${REAL_WORLD_EMAIL_DOMAIN}`,
            firstName: 'Wanjiru',
            lastName: 'Kamau',
            phone: '+254711000101',
            region: KENYA_REGION,
            country: 'Kenya',
        },
        officer: {
            id: 'e2000000-0000-4000-8000-000000000001',
            email: `officer.nakuru${REAL_WORLD_EMAIL_DOMAIN}`,
            firstName: 'Daniel',
            lastName: 'Kiptoo',
            phone: '+254711000201',
            region: KENYA_REGION,
            country: 'Kenya',
        },
        farmers: [
            farmer(1, {
                firstName: 'Mary', lastName: 'Njeri', village: 'Bahati', district: 'Nakuru',
                region: KENYA_REGION, country: 'Kenya', farmSizeHectares: 1.6,
                crops: ['maize', 'beans'], vitalScore: 74.5,
                locationLat: -0.2833, locationLng: 36.0667, languagePreference: 'sw',
            }, '000000000001', '+254711000301', 'nakuru.01'),
            farmer(2, {
                firstName: 'Samuel', lastName: 'Kipchumba', village: 'Rongai', district: 'Nakuru',
                region: KENYA_REGION, country: 'Kenya', farmSizeHectares: 2.8,
                crops: ['maize', 'sorghum'], vitalScore: 68.2,
                locationLat: -0.1667, locationLng: 35.8667, languagePreference: 'sw',
            }, '000000000002', '+254711000302', 'nakuru.02'),
            farmer(3, {
                firstName: 'Alice', lastName: 'Wambui', village: 'Gilgil', district: 'Nakuru',
                region: KENYA_REGION, country: 'Kenya', farmSizeHectares: 3.4,
                crops: ['wheat', 'maize'], vitalScore: 81.9,
                locationLat: -0.5000, locationLng: 36.3167, languagePreference: 'sw',
            }, '000000000003', '+254711000303', 'nakuru.03'),
            farmer(4, {
                firstName: 'Joseph', lastName: 'Kimani', village: 'Naivasha', district: 'Nakuru',
                region: KENYA_REGION, country: 'Kenya', farmSizeHectares: 1.2,
                crops: ['potatoes', 'beans'], vitalScore: 63.7,
                locationLat: -0.7167, locationLng: 36.4333, languagePreference: 'sw',
            }, '000000000004', '+254711000304', 'nakuru.04'),
            farmer(5, {
                firstName: 'Esther', lastName: 'Chebet', village: 'Njoro', district: 'Nakuru',
                region: KENYA_REGION, country: 'Kenya', farmSizeHectares: 4.5,
                crops: ['maize', 'wheat', 'beans'], vitalScore: 86.1,
                locationLat: -0.3333, locationLng: 35.9333, languagePreference: 'sw',
            }, '000000000005', '+254711000305', 'nakuru.05'),
            farmer(6, {
                firstName: 'David', lastName: 'Mwangi', village: 'Subukia', district: 'Nakuru',
                region: KENYA_REGION, country: 'Kenya', farmSizeHectares: 2.0,
                crops: ['maize', 'sorghum'], vitalScore: 71.4,
                locationLat: -0.2000, locationLng: 36.2333, languagePreference: 'sw',
            }, '000000000006', '+254711000306', 'nakuru.06'),
        ],
    },
    {
        manager: {
            id: 'e1000000-0000-4000-8000-000000000002',
            email: `rm.mzuzu${REAL_WORLD_EMAIL_DOMAIN}`,
            firstName: 'Thokozani',
            lastName: 'Mvula',
            phone: '+265991000101',
            region: MALAWI_REGION,
            country: 'Malawi',
        },
        officer: {
            id: 'e2000000-0000-4000-8000-000000000002',
            email: `officer.mzuzu${REAL_WORLD_EMAIL_DOMAIN}`,
            firstName: 'Chisomo',
            lastName: 'Banda',
            phone: '+265991000201',
            region: MALAWI_REGION,
            country: 'Malawi',
        },
        farmers: [
            farmer(1, {
                firstName: 'Loveness', lastName: 'Phiri', village: 'Chibavi', district: 'Mzuzu',
                region: MALAWI_REGION, country: 'Malawi', farmSizeHectares: 1.4,
                crops: ['maize', 'groundnuts'], vitalScore: 70.3,
                locationLat: -11.4656, locationLng: 34.0217, languagePreference: 'ny',
            }, '000000000011', '+265991000301', 'mzuzu.01'),
            farmer(2, {
                firstName: 'Yamikani', lastName: 'Gondwe', village: 'Nkhata Bay', district: 'Nkhata Bay',
                region: MALAWI_REGION, country: 'Malawi', farmSizeHectares: 2.2,
                crops: ['cassava', 'maize'], vitalScore: 77.8,
                locationLat: -11.6000, locationLng: 34.3000, languagePreference: 'ny',
            }, '000000000012', '+265991000302', 'mzuzu.02'),
            farmer(3, {
                firstName: 'Tawonga', lastName: 'Nyirenda', village: 'Rumphi', district: 'Rumphi',
                region: MALAWI_REGION, country: 'Malawi', farmSizeHectares: 3.1,
                crops: ['tobacco', 'maize'], vitalScore: 65.0,
                locationLat: -10.9667, locationLng: 33.8667, languagePreference: 'ny',
            }, '000000000013', '+265991000303', 'mzuzu.03'),
            farmer(4, {
                firstName: 'Chimwemwe', lastName: 'Mhone', village: 'Karonga', district: 'Karonga',
                region: MALAWI_REGION, country: 'Malawi', farmSizeHectares: 0.9,
                crops: ['rice', 'maize'], vitalScore: 58.6,
                locationLat: -9.9333, locationLng: 33.9333, languagePreference: 'ny',
            }, '000000000014', '+265991000304', 'mzuzu.04'),
            farmer(5, {
                firstName: 'Alinafe', lastName: 'Kachale', village: 'Mzimba', district: 'Mzimba',
                region: MALAWI_REGION, country: 'Malawi', farmSizeHectares: 4.0,
                crops: ['maize', 'soya', 'groundnuts'], vitalScore: 83.4,
                locationLat: -11.9000, locationLng: 33.6000, languagePreference: 'ny',
            }, '000000000015', '+265991000305', 'mzuzu.05'),
            farmer(6, {
                firstName: 'Blessings', lastName: 'Chavula', village: 'Likoma', district: 'Likoma',
                region: MALAWI_REGION, country: 'Malawi', farmSizeHectares: 1.1,
                crops: ['cassava', 'beans'], vitalScore: 61.2,
                locationLat: -12.0667, locationLng: 34.7333, languagePreference: 'ny',
            }, '000000000016', '+265991000306', 'mzuzu.06'),
        ],
    },
];

/** Subscription plans the fixtures are put on. */
export type RealWorldPlan = 'Free' | 'Pro';

/**
 * How many farmers per region are on Pro. Farmer chat, "My officer" and field
 * visits are paid features, so managers, officers and the first farmers of
 * each region get Pro (the end-to-end journeys run on them) and the rest stay
 * on Free (the journeys also check that a free farmer is shown the upgrade
 * prompt instead of the officer chat).
 */
export const REAL_WORLD_PRO_FARMERS_PER_REGION = 3;

/** The plan a fixture account is seeded with. */
export function realWorldPlanFor(email: string): RealWorldPlan {
    for (const region of REAL_WORLD_REGIONS) {
        if (email === region.manager.email || email === region.officer.email) return 'Pro';
        const index = region.farmers.findIndex(f => f.email === email);
        if (index >= 0) return index < REAL_WORLD_PRO_FARMERS_PER_REGION ? 'Pro' : 'Free';
    }
    return 'Free';
}

/** Every seeded account, for credential printing and login verification. */
export function allRealWorldAccounts(): Array<RealWorldAccountSeed & { role: 'regional_manager' | 'extension_officer' | 'farmer' }> {
    const accounts: Array<RealWorldAccountSeed & { role: 'regional_manager' | 'extension_officer' | 'farmer' }> = [];
    for (const region of REAL_WORLD_REGIONS) {
        accounts.push({ ...region.manager, role: 'regional_manager' });
        accounts.push({ ...region.officer, role: 'extension_officer' });
        for (const f of region.farmers) {
            accounts.push({
                id: f.userId,
                email: f.email,
                firstName: f.firstName,
                lastName: f.lastName,
                phone: f.phone,
                region: f.region,
                country: f.country,
                role: 'farmer',
            });
        }
    }
    return accounts;
}
