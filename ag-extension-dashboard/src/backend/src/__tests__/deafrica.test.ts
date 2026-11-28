jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));

import axios from 'axios';
import { query } from '@/services/databaseService';
import { parseFeatureInfo, readPoint } from '@/services/deafrica/deafricaClient';
import { baselineDates, monthRainfall, worldCereal2021 } from '@/services/deafrica/satelliteFacts';

const mockGet = axios.get as jest.Mock;
const mockQuery = query as jest.Mock;
const featureInfo = (time: string, bands: Record<string, unknown>, dates: string[] = []) => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { lat: -11.46, lon: 34.02, time, bands, data_available_for_dates: dates } }],
});

beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
});

describe('Digital Earth Africa point values', () => {
    it('read the pixel’s date, bands and dates, in either answer layout', () => {
        expect(parseFeatureInfo(featureInfo('2026-10-01T00:00:00Z', { rainfall: 23.4 }, ['2026-10-01', '2025-10-01']))).toEqual({
            date: '2026-10-01', bands: { rainfall: 23.4 }, availableDates: ['2025-10-01', '2026-10-01'],
        });
        const nested = { features: [{ properties: { data: [{ time: '2026-10-01', bands: { ndvi_std_anomaly: -1.4, ndvi_mean: 'n/a' } }] } }] };
        expect(parseFeatureInfo(nested)).toEqual({ date: '2026-10-01', bands: { ndvi_std_anomaly: -1.4, ndvi_mean: null }, availableDates: [] });
        expect(parseFeatureInfo({ features: [] })).toEqual({ date: null, bands: {}, availableDates: [] });
    });

    it('ask for the one pixel at the point, lat first as WMS 1.3.0 wants, and keep the answer', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
        mockGet.mockResolvedValueOnce({ data: featureInfo('2026-10-01', { rainfall: 23.4 }) });
        await readPoint('rainfall_chirps_monthly', -11.46, 34.02, '2026-10-01');
        const params = mockGet.mock.calls[0][1].params;
        expect(params).toEqual(expect.objectContaining({
            request: 'GetFeatureInfo', layers: 'rainfall_chirps_monthly', info_format: 'application/json', crs: 'EPSG:4326', time: '2026-10-01',
        }));
        const [minLat, minLng] = String(params.bbox).split(',').map(Number);
        expect(minLat).toBeCloseTo(-11.46, 3);
        expect(minLng).toBeCloseTo(34.02, 3);
        expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO satellite_readings/);
    });

    it('never fetch a past date twice', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ observed_on: '2016-10-01', bands: { rainfall: 50 }, available_dates: [], fetched_at: new Date('2020-01-01') }] });
        await expect(readPoint('rainfall_chirps_monthly', -11.46, 34.02, '2016-10-01')).resolves.toEqual(
            { date: '2016-10-01', bands: { rainfall: 50 }, availableDates: [] },
        );
        expect(mockGet).not.toHaveBeenCalled();
    });
});

describe('satellite facts', () => {
    it('compare a month with the same month of up to ten earlier years', () => {
        const dates = ['2014-10-01', '2015-10-01', '2016-10-01', '2025-10-01', '2026-10-01'];
        expect(baselineDates('2026-10-01', dates)).toEqual(['2025-10-01', '2016-10-01']);
        expect(baselineDates('2026-10-01', [])).toHaveLength(10);
    });

    it('give last month’s rain as a share of the average', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        mockGet
            .mockResolvedValueOnce({ data: featureInfo('2026-10-01', { rainfall: 20 }, ['2024-10-01', '2025-10-01', '2026-10-01']) })
            .mockResolvedValueOnce({ data: featureInfo('2025-10-01', { rainfall: 60 }) })
            .mockResolvedValueOnce({ data: featureInfo('2024-10-01', { rainfall: -9999 }) });
        await expect(monthRainfall(-11.46, 34.02)).resolves.toEqual({
            month: '2026-10', rainMm: 20, averageMm: 60, baselineYears: 1, percentOfAverage: 33, source: 'CHIRPS, Digital Earth Africa',
        });
    });

    it('read WorldCereal’s 100 as present and 0 as absent', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        mockGet
            .mockResolvedValueOnce({ data: featureInfo('2021-01-01', { classification: 100, confidence: 88 }) })
            .mockResolvedValueOnce({ data: featureInfo('2021-01-01', { classification: 0, confidence: 71 }) });
        await expect(worldCereal2021(-11.46, 34.02)).resolves.toEqual({
            temporaryCrops: true, maizeMainSeason: false, maizeConfidencePct: 71, source: 'ESA WorldCereal 2021, Digital Earth Africa',
        });
    });
});
