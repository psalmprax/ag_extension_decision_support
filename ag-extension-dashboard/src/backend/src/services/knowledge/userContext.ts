/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

/** Resolved location/crop context for personalizing answers. */
export interface UserLocation {
    crop: string | undefined;
    location?: string;
    region?: string;
    lat?: number;
    lng?: number;
}

const CROP_KEYWORDS = ['maize', 'cassava', 'beans', 'rice', 'banana', 'plantain', 'cocoa', 'coffee', 'yam', 'cowpea', 'soybean', 'groundnut', 'sorghum', 'millet', 'vegetables', 'tomato', 'potato', 'wheat', 'barley', 'oats', 'apples', 'cherries', 'blueberries'];

export function assignUserRegion(userResult: Record<string, any>, finalData: Record<string, any>): void {
    if (userResult.rows.length > 0 && userResult.rows[0].region) {
        finalData.finalRegion = userResult.rows[0].region;
        finalData.finalLocation = userResult.rows[0].region;
    }
}

export function assignFarmerData(farmersResult: Record<string, any>, finalData: Record<string, any>): void {
    if (farmersResult.rows.length === 0) return;

    const firstFarmer = farmersResult.rows[0];
    if (!finalData.finalCrop) {
        const allCrops = farmersResult.rows.flatMap((f: Record<string, any>) => f.crops || []);
        if (allCrops.length > 0) {
            finalData.finalCrop = allCrops[0];
        }
    }
    if (firstFarmer.location) finalData.finalLocation = firstFarmer.location;
    if (firstFarmer.region) finalData.finalRegion = firstFarmer.region;
    if (firstFarmer.location_lat && firstFarmer.location_lng) {
        finalData.finalLat = parseFloat(firstFarmer.location_lat);
        finalData.finalLng = parseFloat(firstFarmer.location_lng);
    }
}

export async function fetchUserAndFarmerContext(userId: string, finalData: Record<string, any>): Promise<void> {
    try {
        const [userResult, farmersResult] = await Promise.all([
            query('SELECT region FROM users WHERE id = $1', [userId]),
            query(`SELECT location, region, location_lat, location_lng, crops FROM farmers WHERE assigned_officer_id = $1 OR user_id = $1 LIMIT 5`, [userId])
        ]);

        assignUserRegion(userResult, finalData);
        assignFarmerData(farmersResult, finalData);
    } catch (err) {
        logger.error('Error fetching context metadata for user/farmer:', err);
    }
}

export async function resolveUserContext(userId: string, queryText: string): Promise<UserLocation> {
    const finalData: Record<string, any> = {
        finalCrop: CROP_KEYWORDS.find(c => queryText.toLowerCase().includes(c)),
        finalLocation: undefined,
        finalRegion: undefined,
        finalLat: undefined,
        finalLng: undefined
    };

    if (userId) {
        await fetchUserAndFarmerContext(userId, finalData);
    }
    return { crop: finalData.finalCrop, location: finalData.finalLocation, region: finalData.finalRegion, lat: finalData.finalLat, lng: finalData.finalLng };
}
