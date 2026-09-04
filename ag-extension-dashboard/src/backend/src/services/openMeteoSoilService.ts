import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';

export interface SoilMoistureSnapshot {
    source: 'Open-Meteo Soil Moisture (modeled)';
    dataStatus: 'modeled_estimate';
    disclaimer: string;
    location: { lat: number; lon: number };
    fetchedAt: string;
    soilMoisture: {
        '0-1cm': number | null;
        '1-3cm': number | null;
        '3-9cm': number | null;
        '9-27cm': number | null;
        avgTop9cm: number | null;
    };
    soilTemperature: {
        '0cm': number | null;
        '6cm': number | null;
        avgTop6cm: number | null;
    };
    unit: { moisture: 'm³/m³'; temperature: '°C' };
}

const BASE = 'https://api.open-meteo.com/v1/forecast';

export class OpenMeteoSoilService {
    static async fetchSnapshot(lat: number, lon: number): Promise<SoilMoistureSnapshot> {
        const cacheKey = `soil:${lat.toFixed(2)}:${lon.toFixed(2)}`;
        return rateLimitedFetch<SoilMoistureSnapshot>('soilMoisture', cacheKey, async () => {
            logger.info(`Fetching Open-Meteo soil moisture for ${lat},${lon}`);
            const resp = await axios.get<{
                current?: Record<string, number>;
                hourly?: Record<string, number[]>;
            }>(BASE, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    current: 'soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm',
                    timezone: 'auto',
                    forecast_days: 1,
                },
                timeout: 10000,
            });

            const cur = resp.data.current ?? {};
            const sm01 = cur.soil_moisture_0_to_1cm ?? null;
            const sm13 = cur.soil_moisture_1_to_3cm ?? null;
            const sm39 = cur.soil_moisture_3_to_9cm ?? null;
            const st0 = cur.soil_temperature_0cm ?? null;
            const st6 = cur.soil_temperature_6cm ?? null;

            const moistVals = [sm01, sm13, sm39].filter((v): v is number => v !== null && Number.isFinite(v));
            const tempVals = [st0, st6].filter((v): v is number => v !== null && Number.isFinite(v));

            return {
                source: 'Open-Meteo Soil Moisture (modeled)',
                dataStatus: 'modeled_estimate',
                disclaimer: 'Modeled estimate from Open-Meteo (ERA5/ECMWF assimilation) — not a field sensor reading. Use lab tests and probe measurements for decisions.',
                location: { lat, lon },
                fetchedAt: new Date().toISOString(),
                soilMoisture: {
                    '0-1cm': sm01,
                    '1-3cm': sm13,
                    '3-9cm': sm39,
                    '9-27cm': null,
                    avgTop9cm: moistVals.length ? Number((moistVals.reduce((a, b) => a + b, 0) / moistVals.length).toFixed(3)) : null,
                },
                soilTemperature: {
                    '0cm': st0,
                    '6cm': st6,
                    avgTop6cm: tempVals.length ? Number((tempVals.reduce((a, b) => a + b, 0) / tempVals.length).toFixed(1)) : null,
                },
                unit: { moisture: 'm³/m³', temperature: '°C' },
            };
        });
    }
}
