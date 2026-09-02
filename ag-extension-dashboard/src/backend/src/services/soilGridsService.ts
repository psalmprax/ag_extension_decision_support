import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';

/**
 * ISRIC SoilGrids v2.0 — real soil baseline provider.
 * Free, no API key required: https://rest.isric.org/soilgrids/v2.0/
 * Provides modeled soil properties at 250m resolution for any lat/lon.
 * Values are regional baselines (250m pixel), NOT field-lab measurements.
 */
export interface SoilGridsPropertyLayer {
    name: string;
    unit: string;
    d_factor: number;
    mean: number;
}

export interface SoilGridsRawResponse {
    properties: {
        layers: Array<{
            name: string;
            unit_measure: { d_factor: number; target_units: string };
            depths: Array<{ label: string; values: { mean: number | null } }>;
        }>;
    };
}

export interface SoilGridsBaseline {
    source: 'ISRIC SoilGrids v2.0 (250m)';
    dataStatus: 'regional_baseline';
    disclaimer: string;
    location: { lat: number; lon: number };
    depth: string;
    ph: number | null; // pH in H2O (0-14)
    organicCarbonGPerKg: number | null; // SOC g/kg
    nitrogenCgPerKg: number | null; // Total N cg/kg (divide by 10 = g/kg)
    nitrogenMgPerKg: number | null; // Derived mg/kg
    cecCmolPerKg: number | null; // CEC cmol(c)/kg
    bulkDensityKgPerM3: number | null;
    sandPct: number | null;
    siltPct: number | null;
    clayPct: number | null;
    raw: SoilGridsRawResponse | null;
}

const SOILGRIDS_BASE = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

const DEFAULT_PROPERTIES = ['phh2o', 'soc', 'nitrogen', 'cec', 'bdod', 'sand', 'silt', 'clay'] as const;
const DEFAULT_DEPTH = '0-5cm';
const TIMEOUT_MS = 15000;

function extractMean(raw: SoilGridsRawResponse | null, prop: string, dFactorFallback: number): number | null {
    if (!raw?.properties?.layers) return null;
    const layer = raw.properties.layers.find(l => l.name === prop);
    if (!layer) return null;
    const depth = layer.depths.find(d => d.label === DEFAULT_DEPTH) ?? layer.depths[0];
    const mean = depth?.values?.mean;
    if (mean === null || mean === undefined) return null;
    const dFactor = layer.unit_measure?.d_factor ?? dFactorFallback;
    return mean / dFactor;
}

export class SoilGridsService {
    static async fetchBaseline(lat: number, lon: number): Promise<SoilGridsBaseline> {
        const cacheKey = `soilgrids:${lat.toFixed(3)}:${lon.toFixed(3)}`;
        return rateLimitedFetch<SoilGridsBaseline>('soilGrids', cacheKey, async () => {
            logger.info(`Fetching SoilGrids baseline for ${lat},${lon}`);
            const params = new URLSearchParams();
            params.set('lon', String(lon));
            params.set('lat', String(lat));
            for (const p of DEFAULT_PROPERTIES) params.append('property', p);
            params.set('depth', DEFAULT_DEPTH);
            params.set('value', 'mean');

            const resp = await axios.get<SoilGridsRawResponse>(`${SOILGRIDS_BASE}?${params.toString()}`, {
                timeout: TIMEOUT_MS,
                headers: { Accept: 'application/json' },
            });

            const raw = resp.data;
            // SoilGrids d_factors: phh2o=10, soc=10 (dg/kg -> g/kg), nitrogen=10 (cg/kg), cec=10, bdod=100 (cg/cm3 -> g/cm3 -> *1000 kg/m3)
            const ph = extractMean(raw, 'phh2o', 10);
            const soc = extractMean(raw, 'soc', 10); // dg/kg -> g/kg
            const nitrogen = extractMean(raw, 'nitrogen', 10); // cg/kg
            const cec = extractMean(raw, 'cec', 10);
            const bdodCg = extractMean(raw, 'bdod', 100); // cg/cm3 -> g/cm3
            const sand = extractMean(raw, 'sand', 10);
            const silt = extractMean(raw, 'silt', 10);
            const clay = extractMean(raw, 'clay', 10);

            return {
                source: 'ISRIC SoilGrids v2.0 (250m)',
                dataStatus: 'regional_baseline',
                disclaimer: 'Regional baseline at 250m resolution — not a substitute for a field laboratory test. Use lab results from Soil Lab History when available.',
                location: { lat, lon },
                depth: DEFAULT_DEPTH,
                ph: ph !== null ? Number(ph.toFixed(2)) : null,
                organicCarbonGPerKg: soc !== null ? Number(soc.toFixed(2)) : null,
                nitrogenCgPerKg: nitrogen !== null ? Number(nitrogen.toFixed(1)) : null,
                nitrogenMgPerKg: nitrogen !== null ? Number((nitrogen * 10).toFixed(1)) : null,
                cecCmolPerKg: cec !== null ? Number(cec.toFixed(2)) : null,
                bulkDensityKgPerM3: bdodCg !== null ? Number((bdodCg * 1000).toFixed(0)) : null,
                sandPct: sand !== null ? Number((sand / 10).toFixed(1)) : null,
                siltPct: silt !== null ? Number((silt / 10).toFixed(1)) : null,
                clayPct: clay !== null ? Number((clay / 10).toFixed(1)) : null,
                raw,
            };
        });
    }

    /** Lightweight connectivity probe — no throw */
    static async isAvailable(): Promise<boolean> {
        try {
            await axios.get(`${SOILGRIDS_BASE}?lon=36.8&lat=-1.28&property=phh2o&depth=0-5cm&value=mean`, { timeout: 5000 });
            return true;
        } catch { return false; }
    }
}
