/**
 * What Digital Earth Africa says about one point, as plain facts with their source and date:
 * last month's rain against the same month in earlier years (CHIRPS), crop greenness
 * against its long-term normal (NDVI anomaly, Landsat and Sentinel-2), whether the point was
 * mapped as cropland in 2019, whether WorldCereal mapped maize there in 2021, and how often
 * satellites have seen it under water since 1984 (WOfS).
 *
 * Nothing here judges the facts; the alert checks decide what to flag, and officers what to say.
 */
import { readPointOrNull, type Bands } from './deafricaClient';

/** Years of the same calendar month compared with the latest one. */
const BASELINE_YEARS = 10;

function value(bands: Bands, name: string, nodataAtOrBelow?: number): number | null {
    const v = bands[name];
    if (v === null || v === undefined) return null;
    return nodataAtOrBelow !== undefined && v <= nodataAtOrBelow ? null : v;
}

export interface MonthRainfall {
    month: string;
    rainMm: number;
    averageMm: number | null;
    baselineYears: number;
    percentOfAverage: number | null;
    source: 'CHIRPS, Digital Earth Africa';
}

/** The same calendar month in up to ten earlier years, from the dates the layer has. */
export function baselineDates(latest: string, available: string[]): string[] {
    const year = Number(latest.slice(0, 4));
    const monthDay = latest.slice(4);
    const wanted = Array.from({ length: BASELINE_YEARS }, (_, k) => `${year - k - 1}${monthDay}`);
    if (available.length === 0) return wanted;
    const month = latest.slice(5, 7);
    return available
        .filter(d => d.slice(5, 7) === month && Number(d.slice(0, 4)) < year && Number(d.slice(0, 4)) >= year - BASELINE_YEARS)
        .sort()
        .reverse();
}

export async function monthRainfall(lat: number, lng: number): Promise<MonthRainfall | null> {
    const latest = await readPointOrNull('rainfall_chirps_monthly', lat, lng);
    const rain = latest ? value(latest.bands, 'rainfall', -9000) : null;
    if (!latest?.date || rain === null) return null;
    const past: number[] = [];
    for (const date of baselineDates(latest.date, latest.availableDates)) {
        const reading = await readPointOrNull('rainfall_chirps_monthly', lat, lng, date);
        const mm = reading ? value(reading.bands, 'rainfall', -9000) : null;
        if (mm !== null) past.push(mm);
    }
    const average = past.length > 0 ? past.reduce((a, b) => a + b, 0) / past.length : null;
    return {
        month: latest.date.slice(0, 7),
        rainMm: Math.round(rain),
        averageMm: average === null ? null : Math.round(average),
        baselineYears: past.length,
        percentOfAverage: average && average > 0 ? Math.round((rain / average) * 100) : null,
        source: 'CHIRPS, Digital Earth Africa',
    };
}

export interface MonthGreenness {
    month: string;
    ndvi: number | null;
    /** Standard deviations from the 1984–2020 mean for that month; negative is less green. */
    stdAnomaly: number;
    clearObservations: number | null;
    source: 'NDVI anomaly, Digital Earth Africa';
}

export async function monthGreenness(lat: number, lng: number): Promise<MonthGreenness | null> {
    const latest = await readPointOrNull('ndvi_anomaly', lat, lng);
    const anomaly = latest ? value(latest.bands, 'ndvi_std_anomaly') : null;
    if (!latest?.date || anomaly === null) return null;
    const ndvi = value(latest.bands, 'ndvi_mean');
    return {
        month: latest.date.slice(0, 7),
        ndvi: ndvi === null ? null : Math.round(ndvi * 100) / 100,
        stdAnomaly: Math.round(anomaly * 10) / 10,
        clearObservations: value(latest.bands, 'clear_count', 0),
        source: 'NDVI anomaly, Digital Earth Africa',
    };
}

export interface FloodHistory {
    /** Share of clear observations that saw water, 0 to 1. */
    frequency: number;
    wetObservations: number | null;
    clearObservations: number | null;
    source: 'WOfS all-time summary, Digital Earth Africa';
}

export async function floodHistory(lat: number, lng: number): Promise<FloodHistory | null> {
    const reading = await readPointOrNull('wofs_ls_summary_alltime', lat, lng);
    const frequency = reading ? value(reading.bands, 'frequency') : null;
    if (!reading || frequency === null) return null;
    return {
        frequency,
        wetObservations: value(reading.bands, 'count_wet', -999),
        clearObservations: value(reading.bands, 'count_clear', -999),
        source: 'WOfS all-time summary, Digital Earth Africa',
    };
}

export interface Cropland2019 { cropland: boolean; probabilityPct: number | null; source: 'Cropland extent 2019, Digital Earth Africa' }

export async function cropland2019(lat: number, lng: number): Promise<Cropland2019 | null> {
    const reading = await readPointOrNull('crop_mask', lat, lng);
    if (!reading) return null;
    const mask = value(reading.bands, 'mask');
    const prob = value(reading.bands, 'prob');
    if (mask === null && prob === null) return null;
    return { cropland: mask === 1, probabilityPct: prob, source: 'Cropland extent 2019, Digital Earth Africa' };
}

/** WorldCereal classes are 100 (present) and 0 (absent); anything else is no answer. */
function worldCerealClass(bands: Bands): { present: boolean | null; confidencePct: number | null } {
    const names = Object.keys(bands);
    const classBand = names.find(n => /class/i.test(n)) ?? names.find(n => !/conf/i.test(n));
    const confidenceBand = names.find(n => /conf/i.test(n));
    const cls = classBand ? bands[classBand] : null;
    return {
        present: cls === 100 ? true : cls === 0 ? false : null,
        confidencePct: confidenceBand ? bands[confidenceBand] ?? null : null,
    };
}

export interface WorldCereal2021 {
    temporaryCrops: boolean | null;
    maizeMainSeason: boolean | null;
    maizeConfidencePct: number | null;
    source: 'ESA WorldCereal 2021, Digital Earth Africa';
}

export async function worldCereal2021(lat: number, lng: number): Promise<WorldCereal2021 | null> {
    const [crops, maize] = await Promise.all([
        readPointOrNull('esa_worldcereal_temporarycrops', lat, lng),
        readPointOrNull('esa_worldcereal_maize_main', lat, lng),
    ]);
    if (!crops && !maize) return null;
    const cropsClass = crops ? worldCerealClass(crops.bands) : { present: null, confidencePct: null };
    const maizeClass = maize ? worldCerealClass(maize.bands) : { present: null, confidencePct: null };
    if (cropsClass.present === null && maizeClass.present === null) return null;
    return {
        temporaryCrops: cropsClass.present,
        maizeMainSeason: maizeClass.present,
        maizeConfidencePct: maizeClass.confidencePct,
        source: 'ESA WorldCereal 2021, Digital Earth Africa',
    };
}

export interface SatelliteRecord {
    rainfall: MonthRainfall | null;
    greenness: MonthGreenness | null;
    floodHistory: FloodHistory | null;
    cropland2019: Cropland2019 | null;
    worldCereal2021: WorldCereal2021 | null;
}

/** Everything above for one point (a field), each part null where the service has nothing. */
export async function satelliteRecord(lat: number, lng: number): Promise<SatelliteRecord> {
    const [rainfall, greenness, flood, cropland, cereal] = await Promise.all([
        monthRainfall(lat, lng), monthGreenness(lat, lng), floodHistory(lat, lng), cropland2019(lat, lng), worldCereal2021(lat, lng),
    ]);
    return { rainfall, greenness, floodHistory: flood, cropland2019: cropland, worldCereal2021: cereal };
}
