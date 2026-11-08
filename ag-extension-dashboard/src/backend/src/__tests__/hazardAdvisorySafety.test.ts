import { evaluateWeatherHazardsWithProvenance, runProactiveHazardScan } from '@/services/weatherHazardDaemonService';
import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/notificationService', () => ({ notificationService: { send: jest.fn() } }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const cold = [{
    date: '2026-11-08', minTempC: 1, maxTempC: 15,
    precipitationMm: 0, relativeHumidityPct: 60, windSpeedKmh: 5,
}];

describe('Weather threshold advisory safety', () => {
    beforeEach(() => jest.clearAllMocks());

    it('labels thresholds as estimates and avoids unsupported interventions', () => {
        const result = evaluateWeatherHazardsWithProvenance(cold);
        const hazard = result.hazards[0];
        expect(hazard.title).toContain('threshold');
        expect(hazard.recommendedIntervention).toContain('guidance');
        expect(hazard.preventiveActionsEnglish).not.toMatch(/fire|spray/i);
        expect(JSON.stringify(result.provenance)).toContain('not official alerts or outbreak diagnoses');
    });

    it('resolves farmer records to notification user IDs and counts only successful sends', async () => {
        jest.mocked(query).mockResolvedValueOnce({ rows: [{ id: 'user-1' }, { id: 'user-2' }], rowCount: 2 });
        jest.mocked(notificationService.send).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const result = await runProactiveHazardScan({
            county: 'Nakuru', forecast: cold, farmerIds: ['d3c86c40-8ad1-4146-87d1-a7e6a76c3757'],
        });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT DISTINCT user_id AS id'),
            ['Nakuru', ['d3c86c40-8ad1-4146-87d1-a7e6a76c3757']]
        );
        expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
        expect(result).toMatchObject({ autoAlertTriggered: true, dispatchedNotificationCount: 1, dispatchErrors: 1 });
    });

    it('does not turn an explicitly empty recipient list into a county-wide send', async () => {
        jest.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const result = await runProactiveHazardScan({ county: 'Nakuru', forecast: cold, farmerIds: [] });
        expect(query).toHaveBeenCalledWith(expect.any(String), ['Nakuru', []]);
        expect(notificationService.send).not.toHaveBeenCalled();
        expect(result.dispatchedNotificationCount).toBe(0);
    });
});
