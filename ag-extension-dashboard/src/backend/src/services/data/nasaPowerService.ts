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
        let lastError: unknown;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.fetchMeteorologicalDataOnce(params);
            } catch (error: any) {
                lastError = error;
                logger.warn(`NASA POWER fetch attempt ${attempt}/3 failed: ${error.message}`);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }
            }
        }

        const message = lastError instanceof Error ? lastError.message : String(lastError);
        logger.error(`Error fetching NASA POWER data after retries: ${message}`);
        throw new Error(`Failed to fetch NASA POWER data: ${message}`);
    }

    private async fetchMeteorologicalDataOnce(params: NasaPowerParams): Promise<any> {
        try {
            // Default to past 30 days if not provided
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 1);
            const end = params.end || endDate.toISOString().split('T')[0].replace(/-/g, '');
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 30);
            const start = params.start || startDate.toISOString().split('T')[0].replace(/-/g, '');
            
            // Key parameters for tropical agriculture:
            // T2M: Temperature at 2 Meters
            // PRECTOTCORR: Precipitation Corrected
            // ALLSKY_SFC_SW_DWN: Solar irradiance
            // GWETPROF: Profile Soil Moisture
            const parameters = params.parameters?.join(',') || 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,GWETPROF';

            const url = new URL(this.baseUrl);
            url.search = new URLSearchParams({
                parameters,
                community: 'AG',
                longitude: String(params.longitude),
                latitude: String(params.latitude),
                start,
                end,
                format: 'JSON'
            }).toString();

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'ag-extension-dashboard/1.0'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`NASA POWER returned HTTP ${response.status}`);
            }

            logger.info(`Successfully fetched NASA POWER data for lat/lng: ${params.latitude}, ${params.longitude}`);
            return response.json();
        } catch (error: any) {
            logger.error(`Error fetching NASA POWER data: ${error.message}`);
            throw new Error(`Failed to fetch NASA POWER data: ${error.message}`);
        }
    }
}

export const nasaPowerService = new NasaPowerService();
