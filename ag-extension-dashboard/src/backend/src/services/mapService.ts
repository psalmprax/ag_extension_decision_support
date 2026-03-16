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

        // Fetch farmers with coordinates
        // For now, we seed random coordinates within Malawi boundaries if not present
        const farmersResult = await query(`
            SELECT id, first_name, last_name, region, village, crops
            FROM farmers
            LIMIT 100
        `);

        // Mock coordinates for Malawian regions if not in DB
        const regionCoords: Record<string, [number, number]> = {
            'Central': [-13.9626, 33.7741],
            'Northern': [-11.4172, 34.0094],
            'Southern': [-15.7861, 35.0058],
            'Lilongwe': [-13.9626, 33.7741],
            'Blantyre': [-15.7833, 35.0000],
            'Mwanza': [-15.6125, 34.5208],
            'Zomba': [-15.3833, 35.3333],
        };

        const features: MapFeature[] = farmersResult.rows.map((f: any) => {
            const base = regionCoords[f.region] || [-13.2543, 34.3015];
            // Add slight jitter
            const lat = base[0] + (Math.random() - 0.5) * 0.5;
            const lng = base[1] + (Math.random() - 0.5) * 0.5;

            return {
                id: f.id,
                type: 'farmer',
                coordinates: [lat, lng],
                properties: {
                    name: `${f.first_name} ${f.last_name}`,
                    region: f.region,
                    village: f.village,
                    crops: f.crops,
                    status: 'active'
                }
            };
        });

        // Add some mock disease alerts
        features.push({
            id: 'alert-1',
            type: 'alert',
            coordinates: [-13.5, 33.8],
            properties: {
                name: 'Maize Lethal Necrosis',
                region: 'Central',
                village: 'Dedza',
                severity: 'high'
            }
        });

        return features;
    } catch (error) {
        logger.error('Error fetching map data:', error);
        return [];
    }
};
