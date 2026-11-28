jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/deafrica/satelliteFacts', () => ({ monthGreenness: jest.fn(), monthRainfall: jest.fn() }));
jest.mock('@/services/weatherService', () => ({ WeatherService: { getByCoordinates: jest.fn() } }));
jest.mock('@/services/outbreakService', () => ({ outbreakService: { getAlertedDistricts: jest.fn(), getAdjacentDistricts: jest.fn() } }));

import { query } from '@/services/databaseService';
import { monthGreenness, monthRainfall } from '@/services/deafrica/satelliteFacts';
import { WeatherService } from '@/services/weatherService';
import { outbreakService } from '@/services/outbreakService';
import { checkCropStress, stressDescription } from '@/services/alerts/cropStressAlerts';
import { checkHarvestRain } from '@/services/alerts/harvestRainAlerts';
import { checkOutbreakSpread, isoWeek } from '@/services/alerts/outbreakAlerts';
import { sendReviewedAlert } from '@/services/alerts/alertReview';

const mockQuery = query as jest.Mock;
const field = { field_id: 'fl1', field_name: 'River plot', crop_name: 'Maize', farmer_id: 'f1', tenant_id: 't1', region: 'Northern Region', lat: '-11.46', lng: '34.02' };
const greenness = (stdAnomaly: number) => ({ month: '2026-10', ndvi: 0.31, stdAnomaly, clearObservations: 4, source: 'NDVI anomaly, Digital Earth Africa' as const });
const rainfall = { month: '2026-10', rainMm: 20, averageMm: 60, baselineYears: 10, percentOfAverage: 33, source: 'CHIRPS, Digital Earth Africa' as const };

beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    delete process.env.GREENNESS_FLAG_STD;
});

describe('crop stress from satellite greenness', () => {
    it('flags a growing field a standard deviation below its normal, for officers only', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [field, { ...field, field_id: 'fl2' }] }).mockResolvedValueOnce({ rows: [{ id: 'a1' }] });
        (monthGreenness as jest.Mock).mockResolvedValueOnce(greenness(-1.4)).mockResolvedValueOnce(greenness(-0.6));
        (monthRainfall as jest.Mock).mockResolvedValue(rainfall);
        await expect(checkCropStress()).resolves.toBe(1);
        const [sql, params] = mockQuery.mock.calls[1];
        expect(sql).toMatch(/'crop_stress'[\s\S]*FALSE, \$7/);
        expect(params[1]).toBe('Less green than normal, with below-average rain: River plot (Maize)');
        expect(params[6]).toBe('greenness:fl1:2026-10');
    });

    it('says what was measured, against what, and asks for a field check', () => {
        expect(stressDescription(greenness(-1.4), rainfall)).toBe(
            'October 2026: greenness 1.4 standard deviations below the 1984–2020 normal for the month (NDVI anomaly, Digital Earth Africa). '
            + 'Rain in October 2026: 20 mm, 33% of the average for the month over 10 earlier years (CHIRPS, Digital Earth Africa). '
            + 'Check the field before advising the farmer.',
        );
    });
});

describe('rain before a harvest', () => {
    it('records a factual farmer alert when moderate or heavier rain is forecast in the next three days', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ cycle_id: 'c1', crop_name: 'maize', expected_harvest_date: new Date('2026-12-02'), farmer_id: 'f1', tenant_id: 't1', region: 'Northern Region', lat: -11.46, lng: 34.02 }] })
            .mockResolvedValueOnce({ rows: [{ id: 'a1' }] });
        (WeatherService.getByCoordinates as jest.Mock).mockResolvedValue({
            forecast: [{ date: '2026-11-29', condition: 'Slight rain' }, { date: '2026-11-30', condition: 'Moderate rain' }],
        });
        await expect(checkHarvestRain()).resolves.toBe(1);
        const [sql, params] = mockQuery.mock.calls[1];
        expect(sql).toMatch(/'harvest_rain'[\s\S]*TRUE, \$6/);
        expect(JSON.parse(params[7])).toEqual({ source: 'Open-Meteo', date: '2026-11-30', condition: 'Moderate rain', crop: 'maize', harvestDate: '2026-12-02' });
    });
});

describe('outbreak spread', () => {
    it('names farmers of the crop in the district and its neighbours, one alert per tenant, for review', async () => {
        (outbreakService.getAlertedDistricts as jest.Mock).mockResolvedValue([{ district: 'Mzimba', crop: 'Maize', diseaseLabel: 'Maize streak virus', caseCount: 6, distinctFarmers: 4 }]);
        (outbreakService.getAdjacentDistricts as jest.Mock).mockResolvedValue(['Rumphi']);
        mockQuery
            .mockResolvedValueOnce({ rows: [{ farmer_id: 'f1', tenant_id: 't1' }, { farmer_id: 'f2', tenant_id: 't2' }] })
            .mockResolvedValue({ rows: [{ id: 'a1' }] });
        await expect(checkOutbreakSpread(new Date('2026-11-28T12:00:00Z'))).resolves.toBe(2);
        expect(mockQuery.mock.calls[0][1]).toEqual([['Mzimba', 'Rumphi'], 'Maize']);
        expect(mockQuery.mock.calls[1][1][3]).toEqual(['f1']);
        expect(mockQuery.mock.calls[1][0]).toMatch(/'outbreak', 'high'[\s\S]*FALSE, \$6/);
        expect(isoWeek(new Date('2026-11-28T12:00:00Z'))).toBe('2026-W48');
    });
});

describe('officer review', () => {
    it('sends the officer’s own words to their farmers only, once', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'a1', type: 'crop_stress', severity: 'medium', location: 'Northern Region', tenant_id: 't1' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'f1' }] })
            .mockResolvedValueOnce({ rows: [{ name: 'Daniel Banda' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
        await expect(sendReviewedAlert('a1', { userId: 'o1', role: 'extension_officer' }, 'Mulch the maize rows this week.')).resolves.toEqual(
            { status: 'sent', alertId: 'm1', farmers: 1, textingOn: false },
        );
        expect(mockQuery.mock.calls[1][0]).toMatch(/assigned_officer_id = \$1/);
        const params = mockQuery.mock.calls[3][1];
        expect(params[2]).toBe('Mulch the maize rows this week.');
        expect(params[6]).toBe('review:a1:o1');
        expect(JSON.parse(params[7])).toEqual({ officerName: 'Daniel Banda', reviewOf: 'a1' });

        mockQuery.mockReset()
            .mockResolvedValueOnce({ rows: [{ id: 'a1', type: 'crop_stress', severity: 'medium', location: null, tenant_id: 't1' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'f1' }] })
            .mockResolvedValueOnce({ rows: [{ name: 'Daniel Banda' }] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(sendReviewedAlert('a1', { userId: 'o1', role: 'extension_officer' }, 'Again')).resolves.toEqual({ status: 'already_sent' });
    });

    it('refuses an officer none of whose farmers are named', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a1', type: 'outbreak', severity: 'high', location: null, tenant_id: 't1' }] }).mockResolvedValueOnce({ rows: [] });
        await expect(sendReviewedAlert('a1', { userId: 'o2', role: 'extension_officer' }, 'Hello farmers')).resolves.toEqual({ status: 'no_farmers' });
    });
});
