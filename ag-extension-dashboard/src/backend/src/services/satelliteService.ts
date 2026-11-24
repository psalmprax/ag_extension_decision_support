import { logger } from '../utils/logger';
import { outboundSignal } from '@/utils/outboundTimeout';

export interface SpectralData {
    ndvi: number;
    color: string;
    health: 'critical' | 'normal' | 'healthy';
    timestamp: string;
    latitude: number;
    longitude: number;
    source: 'sentinel-hub' | 'nasa-gibs';
    dataStatus: 'live';
    cloudCover: number | null;
    resolution: string;
}

/** Daily rain and mean air temperature that NASA POWER reports for a point: weather, not the crop. */
export interface DailyWeatherResult {
    data: Array<{ date: string; rainMm: number; tempC: number }>;
    source: 'nasa-power';
    dataStatus: 'live' | 'unavailable';
    reason: string;
}

/** NASA POWER marks a missing value with -999. */
const isMeasured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > -900;

export interface SatelliteImagery {
    url: string;
    date: string;
    cloudCover: number | null;
    resolution: string;
    bands: string[];
    source: 'nasa-gibs';
    dataStatus: 'provider_url_only';
}

export class SatelliteService {
    private static sentinelHubClientId = process.env.SENTINEL_HUB_CLIENT_ID;
    private static sentinelHubClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;
    private static nasaApiKey = process.env.NASA_EARTHDATA_KEY;

    static async getSpectralIndices(lat: number, lng: number): Promise<SpectralData[]> {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Valid coordinates are required');
        try {
            if (this.sentinelHubClientId && this.sentinelHubClientSecret) return await this.fetchSentinelHubNDVI(lat, lng);
            if (this.nasaApiKey) return await this.fetchNASAGIBS(lat, lng);
            logger.warn('Satellite credentials are not configured; no live observation is available');
            return [];
        } catch (error) {
            logger.error('Satellite data fetch failed:', error);
            return [];
        }
    }

    private static async fetchSentinelHubNDVI(lat: number, lng: number): Promise<SpectralData[]> {
        const token = await this.getSentinelHubToken();
        const evalscript = `
            //VERSION=3
            function setup() {
                return { input: [{ bands: ["B04", "B08", "dataMask"], units: "DN" }], output: { bands: 1, sampleType: "FLOAT32" } };
            }
            function evaluatePixel(sample) { return [index(sample.B08, sample.B04)]; }
        `;
        const response = await fetch('https://services.sentinel-hub.com/api/v1/process', {
            method: 'POST',
            signal: outboundSignal(),
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: {
                    bounds: { bbox: [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005] },
                    data: [{ dataFilter: { timeRange: { from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] }, maxCloudCoverage: 20 } }],
                },
                output: { width: 512, height: 512, responses: [{ identifier: 'default', evalscript }] },
            }),
        });
        if (!response.ok) throw new Error(`Sentinel Hub API error: ${response.status}`);
        const data = (await response.json()) as { channels?: number[][] };
        const ndvi = data?.channels?.[0]?.[0];
        if (typeof ndvi !== 'number' || !Number.isFinite(ndvi)) return [];
        return [this.toSpectralData(ndvi, lat, lng, 'sentinel-hub', '10m')];
    }

    private static async fetchNASAGIBS(lat: number, lng: number): Promise<SpectralData[]> {
        const date = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
        const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=MODIS_Terra_Vegetation_Indices&STYLES=&SRS=EPSG:4326&BBOX=${lat - 0.1},${lng - 0.1},${lat + 0.1},${lng + 0.1}&WIDTH=256&HEIGHT=256&TIME=${date}&INFO_FORMAT=application/json`;
        const response = await fetch(url, { signal: outboundSignal() });
        if (!response.ok) throw new Error(`NASA GIBS API error: ${response.status}`);
        const data = (await response.json()) as { features?: Array<{ properties?: { ndvi?: number } }> };
        const ndvi = data?.features?.[0]?.properties?.ndvi;
        if (typeof ndvi !== 'number' || !Number.isFinite(ndvi)) return [];
        return [this.toSpectralData(ndvi, lat, lng, 'nasa-gibs', '250m')];
    }

    /**
     * Daily rain (mm) and mean temperature (°C) from NASA POWER for the last `days` days. These are
     * measurements of the weather, not of the crop: they replace a vegetation score that was a
     * formula of the app's own on these two values, with no source.
     */
    static async getDailyWeather(lat: number, lng: number, days = 14): Promise<DailyWeatherResult> {
        const source = 'nasa-power' as const;
        try {
            const { NasaPowerService } = await import('./nasaPowerService');
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            const daily = await NasaPowerService.getDaily(lat, lng, startDate, endDate, ['T2M', 'PRECTOTCORR']);
            const data = (Array.isArray(daily) ? daily : [])
                .filter(d => isMeasured(d.T2M) && isMeasured(d.PRECTOTCORR))
                .map(d => ({
                    date: String(d.date || '').slice(0, 10),
                    rainMm: Math.round(Number(d.PRECTOTCORR) * 10) / 10,
                    tempC: Math.round(Number(d.T2M) * 10) / 10,
                }));
            if (data.length === 0) {
                return { data, source, dataStatus: 'unavailable', reason: 'NASA POWER has no measurements for these days yet.' };
            }
            return { data, source, dataStatus: 'live', reason: 'Daily rain and mean air temperature from NASA POWER for this location.' };
        } catch {
            return { data: [], source, dataStatus: 'unavailable', reason: 'NASA POWER could not be reached.' };
        }
    }

    static async getImageryUrl(lat: number, lng: number, date?: string): Promise<SatelliteImagery> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const zoom = 12;
        const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        return {
            url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${targetDate}/GoogleMapsCompatible_Level${zoom}/${zoom}/${x}/${y}.jpg`,
            date: targetDate,
            cloudCover: null,
            resolution: '250m',
            bands: ['red', 'green', 'blue'],
            source: 'nasa-gibs',
            dataStatus: 'provider_url_only',
        };
    }

    private static toSpectralData(ndvi: number, lat: number, lng: number, source: SpectralData['source'], resolution: string): SpectralData {
        return {
            ndvi,
            color: this.ndviToColor(ndvi),
            health: this.classifyHealth(ndvi),
            timestamp: new Date().toISOString(),
            latitude: lat,
            longitude: lng,
            source,
            dataStatus: 'live',
            cloudCover: null,
            resolution,
        };
    }

    private static ndviToColor(ndvi: number): string {
        if (ndvi < 0) return '#8B4513';
        if (ndvi < 0.2) return '#D2B48C';
        if (ndvi < 0.4) return '#9ACD32';
        if (ndvi < 0.6) return '#32CD32';
        return '#228B22';
    }

    private static classifyHealth(ndvi: number): 'critical' | 'normal' | 'healthy' {
        if (ndvi < 0.3) return 'critical';
        if (ndvi < 0.6) return 'normal';
        return 'healthy';
    }

    private static async getSentinelHubToken(): Promise<string> {
        const response = await fetch('https://services.sentinel-hub.com/oauth/token', {
            method: 'POST',
            signal: outboundSignal(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.sentinelHubClientId!, client_secret: this.sentinelHubClientSecret! }),
        });
        if (!response.ok) throw new Error(`Sentinel Hub auth error: ${response.status}`);
        const data = (await response.json()) as { access_token?: string };
        if (typeof data?.access_token !== 'string' || data.access_token.length === 0) throw new Error('Sentinel Hub returned no access token');
        return data.access_token;
    }
}
