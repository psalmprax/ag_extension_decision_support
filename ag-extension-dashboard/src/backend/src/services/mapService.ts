/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, getPool } from './databaseService';
import { logger } from '../utils/logger';

export interface MapFeature {
    id: string;
    type: 'farmer' | 'visit' | 'alert';
    coordinates: [number, number]; // [lat, lng]
    properties: {
        name: string;
        region: string;
        village: string;
        crops?: string[];
        status?: string;
        severity?: 'low' | 'medium' | 'high';
    };
}

export const getMapData = async (): Promise<MapFeature[]> => {
    try {
        const pool = getPool();
        if (!pool) return [];

        // Fetch farmers with real coordinates
        const farmersResult = await query(`
            SELECT id, first_name, last_name, region, village, crops, 
                   location_lat as lat, location_lng as lng
            FROM farmers
            WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL
            LIMIT 200
        `);

        // Fetch active alerts
        const alertsResult = await query(`
            SELECT id, title, type, location, severity
            FROM alerts
            WHERE is_active = true
        `);

        // Map farmers
        const features: MapFeature[] = farmersResult.rows.map((f: any) => ({
            id: f.id,
            type: 'farmer',
            coordinates: [Number(f.lat), Number(f.lng)],
            properties: {
                name: `${f.first_name} ${f.last_name}`,
                region: f.region,
                village: f.village,
                crops: f.crops,
                status: 'active'
            }
        }));

        // Map alerts (using simple geocoding or specific alert coordinates)
        const regionCoords: Record<string, [number, number]> = {
            'Central Region': [-0.4167, 36.9500],
            'Rift Valley': [-0.2833, 36.0667],
            'Coast Region': [-4.0500, 39.6667],
            'Nairobi': [-1.2863, 36.8172],
            'Western': [0.2833, 34.7500],
            'Eastern': [-0.5833, 37.5000],
            'Nyanza': [-0.1000, 34.7500],
            'North Eastern': [0.3500, 40.1667]
        };

        alertsResult.rows.forEach((a: any) => {
            const coords = regionCoords[a.location] || [-1.2863, 36.8172];
            features.push({
                id: a.id,
                type: 'alert',
                coordinates: coords,
                properties: {
                    name: a.title,
                    region: a.location,
                    village: '',
                    severity: a.severity as any
                }
            });
        });

        return features;
    } catch (error) {
        logger.error('Error fetching map data:', error);
        return [];
    }
};
