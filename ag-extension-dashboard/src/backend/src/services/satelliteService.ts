import { logger } from '../utils/logger';

export interface SpectralData {
    ndvi: number;
    color: string;
    health: 'critical' | 'normal' | 'healthy';
    timestamp: string;
    latitude: number;
    longitude: number;
    source: string;
    cloudCover: number;
    resolution: string;
}

export interface NDVITimeSeries {
    date: string;
    ndvi: number;
}

export interface SatelliteImagery {
    url: string;
    date: string;
    cloudCover: number;
    resolution: string;
    bands: string[];
}

export class SatelliteService {
    private static sentinelHubClientId = process.env.SENTINEL_HUB_CLIENT_ID;
    private static sentinelHubClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;
    private static nasaApiKey = process.env.NASA_EARTHDATA_KEY;

    static async getSpectralIndices(lat: number, lng: number): Promise<SpectralData[]> {
        try {
            if (!lat || !lng) {
                throw new Error('Coordinates are required');
            }

            logger.info(`Satellite data requested for Lat: ${lat}, Lng: ${lng}`);

            if (this.sentinelHubClientId && this.sentinelHubClientSecret) {
                return this.fetchSentinelHubNDVI(lat, lng);
            }

            if (this.nasaApiKey) {
                return this.fetchNASAGIBS(lat, lng);
            }

            return this.generateFallbackNDVI(lat, lng);
        } catch (error) {
            logger.error('Satellite data fetch failed:', error);
            return this.generateFallbackNDVI(lat, lng);
        }
    }

    private static async fetchSentinelHubNDVI(lat: number, lng: number): Promise<SpectralData[]> {
        const token = await this.getSentinelHubToken();
        const evalscript = `
            //VERSION=3
            function setup() {
                return {
                    input: [{ bands: ["B04", "B08", "dataMask"], units: "DN" }],
                    output: { bands: 1, sampleType: "FLOAT32" }
                };
            }
            function evaluatePixel(sample) {
                let ndvi = index(sample.B08, sample.B04);
                return [ndvi];
            }
        `;

        const response = await fetch('https://services.sentinel-hub.com/api/v1/process', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: {
                    bounds: {
                        bbox: [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005],
                    },
                    data: [{
                        dataFilter: {
                            timeRange: {
                                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                to: new Date().toISOString().split('T')[0],
                            },
                            maxCloudCoverage: 20,
                        },
                    }],
                },
                output: {
                    width: 512,
                    height: 512,
                    responses: [{
                        identifier: 'default',
                        evalscript,
                    }],
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Sentinel Hub API error: ${response.status}`);
        }

        const data: any = await response.json();
        const ndvi = data?.channels?.[0]?.[0] || 0;

        return [{
            ndvi,
            color: this.ndviToColor(ndvi),
            health: this.classifyHealth(ndvi),
            timestamp: new Date().toISOString(),
            latitude: lat,
            longitude: lng,
            source: 'sentinel-hub',
            cloudCover: 0,
            resolution: '10m',
        }];
    }

    private static async fetchNASAGIBS(lat: number, lng: number): Promise<SpectralData[]> {
        const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=MODIS_Terra_Vegetation_Indices&STYLES=&SRS=EPSG:4326&BBOX=${lat - 0.1},${lng - 0.1},${lat + 0.1},${lng + 0.1}&WIDTH=256&HEIGHT=256&TIME=${date}&INFO_FORMAT=application/json`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`NASA GIBS API error: ${response.status}`);
        }

        const data: any = await response.json();
        const ndvi = data?.features?.[0]?.properties?.ndvi || 0.5;

        return [{
            ndvi,
            color: this.ndviToColor(ndvi),
            health: this.classifyHealth(ndvi),
            timestamp: new Date().toISOString(),
            latitude: lat,
            longitude: lng,
            source: 'nasa-gibs',
            cloudCover: 0,
            resolution: '250m',
        }];
    }

    static async getNDVITimeSeries(lat: number, lng: number, days = 90): Promise<NDVITimeSeries[]> {
        const series: NDVITimeSeries[] = [];
        const now = new Date();

        for (let i = days; i >= 0; i -= 5) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const ndvi = this.simulateNDVI(lat, lng, date);
            series.push({
                date: date.toISOString().split('T')[0],
                ndvi,
            });
        }

        return series;
    }

    static async getImageryUrl(lat: number, lng: number, date?: string): Promise<SatelliteImagery> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const zoom = 12;

        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${targetDate}/GoogleMapsCompatible_Level${zoom}/${zoom}/${Math.floor(lng + 180) / 360 * Math.pow(2, zoom)}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.jpg`;

        return {
            url,
            date: targetDate,
            cloudCover: 0,
            resolution: '250m',
            bands: ['red', 'green', 'blue'],
        };
    }

    private static generateFallbackNDVI(lat: number, lng: number): SpectralData[] {
        const ndvi = this.simulateNDVI(lat, lng, new Date());

        return [{
            ndvi,
            color: this.ndviToColor(ndvi),
            health: this.classifyHealth(ndvi),
            timestamp: new Date().toISOString(),
            latitude: lat,
            longitude: lng,
            source: 'fallback-estimate',
            cloudCover: 0,
            resolution: 'estimated',
        }];
    }

    private static simulateNDVI(lat: number, _lng: number, date: Date): number {
        const month = date.getMonth();
        const absLat = Math.abs(lat);

        let baseNDVI = 0.3;
        if (absLat < 23.5) baseNDVI = 0.5 + Math.sin((month - 3) * Math.PI / 6) * 0.2;
        else if (absLat < 45) baseNDVI = 0.4 + Math.sin((month - 4) * Math.PI / 6) * 0.25;
        else baseNDVI = 0.3 + Math.sin((month - 5) * Math.PI / 6) * 0.3;

        const noise = (Math.sin(lat * 10 + _lng * 5) * 0.1);
        return Math.max(0, Math.min(1, baseNDVI + noise));
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.sentinelHubClientId!,
                client_secret: this.sentinelHubClientSecret!,
            }),
        });

        if (!response.ok) {
            throw new Error(`Sentinel Hub auth error: ${response.status}`);
        }

        const data: any = await response.json();
        return data.access_token;
    }
}
