import axios from 'axios';
import { logger } from '../../utils/logger';

export interface NasaPowerParams {
    latitude: number;
    longitude: number;
    start?: string; // YYYYMMDD
    end?: string;   // YYYYMMDD
    parameters?: string[];
}

/**
 * Service to interact with the NASA POWER API for agroclimatology data.
 */
export class NasaPowerService {
    private readonly baseUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point';

    async fetchMeteorologicalData(params: NasaPowerParams): Promise<any> {
        try {
            // Default to past 30 days if not provided
            const end = params.end || new Date().toISOString().split('T')[0].replace(/-/g, '');
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const start = params.start || startDate.toISOString().split('T')[0].replace(/-/g, '');
            
            // Key parameters for tropical agriculture:
            // T2M: Temperature at 2 Meters
            // PRECTOTCORR: Precipitation Corrected
            // ALLSKY_SFC_SW_DWN: Solar irradiance
            // GWETPROF: Profile Soil Moisture
            const parameters = params.parameters?.join(',') || 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,GWETPROF';

            const response = await axios.get(this.baseUrl, {
                params: {
                    parameters,
                    community: 'AG',
                    longitude: params.longitude,
                    latitude: params.latitude,
                    start,
                    end,
                    format: 'JSON'
                }
            });

            logger.info(`Successfully fetched NASA POWER data for lat/lng: ${params.latitude}, ${params.longitude}`);
            return response.data;
        } catch (error: any) {
            logger.error(`Error fetching NASA POWER data: ${error.message}`);
            throw new Error(`Failed to fetch NASA POWER data: ${error.message}`);
        }
    }
}

export const nasaPowerService = new NasaPowerService();
