import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

/** Resolved location/crop context for personalizing answers. */
export interface UserLocation {
    crop: string | undefined;
    country?: string;
    location?: string;
    region?: string;
    lat?: number;
    lng?: number;
}

interface UserRegionRow {
    region: string | null;
    country: string | null;
}

interface FarmerContextRow {
    location: string | null;
    region: string | null;
    location_lat: string | number | null;
    location_lng: string | number | null;
    crops: string[] | null;
}

interface MutableContextData {
    finalCrop?: string;
    finalCountry?: string;
    finalLocation?: string;
    finalRegion?: string;
    finalLat?: number;
    finalLng?: number;
}

const CROP_KEYWORDS = ['maize', 'cassava', 'beans', 'rice', 'banana', 'plantain', 'cocoa', 'coffee', 'yam', 'cowpea', 'soybean', 'groundnut', 'sorghum', 'millet', 'vegetables', 'tomato', 'potato', 'wheat', 'barley', 'oats', 'apples', 'cherries', 'blueberries'];

function assignUserRegion(userResult: { rows: UserRegionRow[] }, finalData: MutableContextData): void {
    if (userResult.rows[0]?.country) {
        finalData.finalCountry = userResult.rows[0].country;
    }
    if (userResult.rows.length > 0 && userResult.rows[0].region) {
        finalData.finalRegion = userResult.rows[0].region;
        finalData.finalLocation = userResult.rows[0].region;
    }
}

function assignFarmerData(farmersResult: { rows: FarmerContextRow[] }, finalData: MutableContextData): void {
    // An officer's first assigned farmer is not necessarily the subject of a query.
    if (farmersResult.rows.length !== 1) return;

    const firstFarmer = farmersResult.rows[0];
    if (!finalData.finalCrop) {
        const allCrops = farmersResult.rows.flatMap((f) => f.crops || []);
        if (allCrops.length > 0) {
            finalData.finalCrop = allCrops[0];
        }
    }
    if (firstFarmer.location) finalData.finalLocation = firstFarmer.location;
    if (firstFarmer.region) finalData.finalRegion = firstFarmer.region;
    if (firstFarmer.location_lat !== null && firstFarmer.location_lng !== null) {
        const lat = parseFloat(String(firstFarmer.location_lat));
        const lng = parseFloat(String(firstFarmer.location_lng));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            finalData.finalLat = lat;
            finalData.finalLng = lng;
        }
    }
}

async function fetchUserAndFarmerContext(userId: string, finalData: MutableContextData): Promise<void> {
    try {
        const [userResult, farmersResult] = await Promise.all([
            query<UserRegionRow>('SELECT country, region FROM users WHERE id = $1', [userId]),
            query<FarmerContextRow>(`SELECT location, region, location_lat, location_lng, crops FROM farmers WHERE user_id = $1 LIMIT 5`, [userId])
        ]);

        assignUserRegion(userResult, finalData);
        assignFarmerData(farmersResult, finalData);
    } catch (err) {
        logger.error('Error fetching context metadata for user/farmer:', err);
    }
}

export async function resolveUserContext(userId: string, queryText: string): Promise<UserLocation> {
    const finalData: MutableContextData = {
        finalCrop: CROP_KEYWORDS.find(c => queryText.toLowerCase().includes(c)),
        finalLocation: undefined,
        finalRegion: undefined,
        finalLat: undefined,
        finalLng: undefined
    };

    if (userId) {
        await fetchUserAndFarmerContext(userId, finalData);
    }
    return { crop: finalData.finalCrop, country: finalData.finalCountry, location: finalData.finalLocation, region: finalData.finalRegion, lat: finalData.finalLat, lng: finalData.finalLng };
}
