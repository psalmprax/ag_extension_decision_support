import { logger } from '../utils/logger';

export interface SpectralData {
    ndvi: number;
    color: string;
    health: 'critical' | 'normal' | 'healthy';
    timestamp: string;
}

export class SatelliteService {
    /**
     * Fetch NDVI (Normalized Difference Vegetation Index) for a specific coordinate.
     * Requires a real satellite data provider (Sentinel Hub, Google Earth Engine, or Planet API).
     * Returns empty array when no provider is configured.
     */
    static async getSpectralIndices(lat: number, lng: number): Promise<SpectralData[]> {
        try {
            if (!lat || !lng) {
                throw new Error('Coordinates are required');
            }

            logger.info(`Satellite data requested for Lat: ${lat}, Lng: ${lng}`);

            // No satellite API provider is configured — return empty state
            return [];
        } catch (error) {
            logger.error('Satellite data fetch failed:', error);
            throw new Error('Failed to retrieve satellite telemetry');
        }
    }
}
