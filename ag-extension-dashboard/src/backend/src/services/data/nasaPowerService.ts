import { logger } from '../../utils/logger';
// Canonical re-export — single source of truth is services/nasaPowerService.ts (rateLimitedFetch + caching)
// Deprecated wrapper: prefer importing from '@/services/nasaPowerService' directly
export { NasaPowerService as CanonicalNasaPowerService } from '../nasaPowerService';

export interface NasaPowerResponse {
    properties?: { parameter?: Record<string, Record<string, number>> };
    geometry?: { coordinates?: number[] };
    [key: string]: unknown;
}

export interface NasaAgroclimateSummary {
    source: string;
    location: { latitude: number; longitude: number };
    elevation: number | string;
    period: string;
    temperatureRange?: { min: number | string; max: number | string };
    relativeHumidity?: number | string;
    precipitationSum?: number | string;
    solarRadiationAvg?: number | string;
    metrics: {
        avg_temp_C: number | string;
        max_temp_C: number | string;
        min_temp_C: number | string;
        total_precipitation_mm: number | string;
        avg_solar_irradiance: number | string;
        avg_profile_soil_moisture: number | string;
    };
}

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
/** @deprecated — use NasaPowerService from '@/services/nasaPowerService' */
export class NasaPowerService {
    private readonly baseUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point';

    async fetchMeteorologicalData(params: NasaPowerParams): Promise<NasaPowerResponse> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.fetchMeteorologicalDataOnce(params);
            } catch (error) {
                lastError = error;
                logger.warn(`NASA POWER fetch attempt ${attempt}/3 failed: ${error instanceof Error ? error.message : "Unknown error"}`);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }
            }
        }

        const message = lastError instanceof Error ? lastError.message : String(lastError);
        logger.error(`Error fetching NASA POWER data after retries: ${message}`);
        throw new Error(`Failed to fetch NASA POWER data: ${message}`);
    }

    private async fetchMeteorologicalDataOnce(params: NasaPowerParams): Promise<NasaPowerResponse> {
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
            return response.json() as Promise<NasaPowerResponse>;
        } catch (error) {
            logger.error(`Error fetching NASA POWER data: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw new Error(`Failed to fetch NASA POWER data: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    async getAgroclimateSummary(latitude: number, longitude: number, days: number = 7): Promise<NasaAgroclimateSummary> {
        const end = new Date();
        end.setDate(end.getDate() - 1);
        const start = new Date(end);
        start.setDate(end.getDate() - Math.min(days, 30));

        const formatString = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
        const data = await this.fetchMeteorologicalData({
            latitude,
            longitude,
            start: formatString(start),
            end: formatString(end)
        });

        const params = data?.properties?.parameter || {};

        return {
            source: 'NASA POWER API (Agroclimatology)',
            location: { latitude, longitude },
            elevation: data?.geometry?.coordinates?.[2] || 'Unknown',
            period: `${formatString(start)} to ${formatString(end)}`,
            temperatureRange: { min: calculateMin(params.T2M_MIN), max: calculateMax(params.T2M_MAX) },
            relativeHumidity: 'N/A',
            precipitationSum: calculateSum(params.PRECTOTCORR),
            solarRadiationAvg: calculateAverage(params.ALLSKY_SFC_SW_DWN),
            metrics: {
                avg_temp_C: calculateAverage(params.T2M),
                max_temp_C: calculateMax(params.T2M_MAX),
                min_temp_C: calculateMin(params.T2M_MIN),
                total_precipitation_mm: calculateSum(params.PRECTOTCORR),
                avg_solar_irradiance: calculateAverage(params.ALLSKY_SFC_SW_DWN),
                avg_profile_soil_moisture: calculateAverage(params.GWETPROF)
            }
        };
    }
}

function validValues(dataObj?: Record<string, number>): number[] {
    if (!dataObj) return [];
    return Object.values(dataObj).filter(v => v !== -999 && Number.isFinite(v));
}

function calculateAverage(dataObj?: Record<string, number>): number | string {
    const values = validValues(dataObj);
    if (values.length === 0) return 'N/A';
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

function calculateSum(dataObj?: Record<string, number>): number | string {
    const values = validValues(dataObj);
    if (values.length === 0) return 'N/A';
    return Number(values.reduce((a, b) => a + b, 0).toFixed(2));
}

function calculateMax(dataObj?: Record<string, number>): number | string {
    const values = validValues(dataObj);
    if (values.length === 0) return 'N/A';
    return Number(Math.max(...values).toFixed(2));
}

function calculateMin(dataObj?: Record<string, number>): number | string {
    const values = validValues(dataObj);
    if (values.length === 0) return 'N/A';
    return Number(Math.min(...values).toFixed(2));
}

export const nasaPowerService = new NasaPowerService();
