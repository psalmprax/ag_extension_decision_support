import { advisoryRules, toDailyClimate, seasonalAdvisoryService, DailyClimate, AdvisoryRuleKey } from '../services/seasonalAdvisoryService';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));
jest.mock('../services/nasaPowerService', () => ({
    NasaPowerService: { getDaily: jest.fn() },
}));
jest.mock('../services/whatsappService', () => ({ whatsappService: { sendMessage: jest.fn().mockResolvedValue(true) } }));
jest.mock('../services/smsService', () => ({ smsService: { sendSMS: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/queues/emailQueue', () => ({ addEmailJob: jest.fn().mockResolvedValue(undefined) }), { virtual: true });
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() } }));

import { NasaPowerService } from '../services/nasaPowerService';
import { whatsappService } from '../services/whatsappService';
const mockQuery = query as jest.Mock;
const mockGetDaily = NasaPowerService.getDaily as jest.Mock;
const mockSend = whatsappService.sendMessage as jest.Mock;

const wetWeek: DailyClimate[] = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    rainMm: i >= 23 ? 5 : 0.5,
    tempMinC: 18,
    tempMaxC: 27,
    humidityPct: 60,
}));


const monthOfWetDays = () =>
    Array.from({ length: 30 }, (_, i) => ({
        date: `2026-08-${String(i + 1).padStart(2, '0')}`,
        T2M: 22,
        T2M_MIN: 18,
        T2M_MAX: 27,
        PRECTOTCORR: i >= 23 ? 5 : 0.5,
        RH2M: 60,
    }));

describe('advisory rules (pure)', () => {
    it('planting_window fires after ≥25mm over the trailing week', () => {
        const verdict = advisoryRules.planting_window({ district: 'Lilongwe', daily: wetWeek });
        expect(verdict.shouldDispatch).toBe(true);
        expect(verdict.message).toMatch(/Planting window/);
    });

    it('planting_window stays quiet in a dry week', () => {
        const dry = wetWeek.map(d => ({ ...d, rainMm: 0.2 }));
        expect(advisoryRules.planting_window({ district: 'X', daily: dry }).shouldDispatch).toBe(false);
    });

    it('dry_spell_warning fires below 5mm over 5 days', () => {
        const dry = wetWeek.map(d => ({ ...d, rainMm: 0.4 }));
        const verdict = advisoryRules.dry_spell_warning({ district: 'X', daily: dry });
        expect(verdict.shouldDispatch).toBe(true);
        expect(verdict.severity).toBe('warning');
    });

    it('faw_degree_day fires above 380 accumulated degree-days', () => {
        const hot = wetWeek.map(d => ({ ...d, tempMinC: 22, tempMaxC: 32 }));
        const verdict = advisoryRules.faw_degree_day({ district: 'X', daily: hot });
        expect(verdict.shouldDispatch).toBe(true);
        expect(verdict.params.degreeDays).toBeGreaterThan(380);
    });

    it('late_blight_risk fires after two cool humid days', () => {
        const humid = wetWeek.map((d, i) => ({ ...d, humidityPct: i >= 28 ? 95 : 60, tempMinC: 12, tempMaxC: 22 }));
        const verdict = advisoryRules.late_blight_risk({ district: 'X', daily: humid });
        expect(verdict.shouldDispatch).toBe(true);
        expect(verdict.severity).toBe('urgent');
    });

    it('handles insufficient data without firing', () => {
        for (const key of Object.keys(advisoryRules) as AdvisoryRuleKey[]) {
            expect(advisoryRules[key]({ district: 'X', daily: [] }).shouldDispatch).toBe(false);
        }
    });

    it('toDailyClimate tolerates missing NASA params', () => {
        const climate = toDailyClimate([{ date: '2026-08-24', T2M: 20, PRECTOTCORR: 3 }]);
        expect(climate[0].rainMm).toBe(3);
        expect(climate[0].tempMinC).toBe(20);
        expect(climate[0].humidityPct).toBe(0);
    });
});

describe('seasonalAdvisoryService.evaluateDistrict', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockSend.mockClear();
        mockGetDaily.mockReset();
    });

    it('dispatches deduped advisories to opted-in farmers on matching categories', async () => {
        mockGetDaily.mockResolvedValue(monthOfWetDays());
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes('ON CONFLICT (dedupe_hash) DO NOTHING')) {
                return Promise.resolve({ rows: [{ id: 'd1' }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const farmers = [{
            farmer_id: 'f-1', phone: '+265999111222', channels: ['whatsapp'],
            categories: ['planting_window'], lat: -13.9, lng: 33.7,
        }];
        const fired = await seasonalAdvisoryService.evaluateDistrict('Lilongwe', farmers, '2026-08-24');
        expect(fired).toContain('planting_window');
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0].to).toBe('+265999111222');
    });

    it('skips farmers whose categories exclude the fired rule', async () => {
        mockGetDaily.mockResolvedValue(monthOfWetDays());
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes('ON CONFLICT (dedupe_hash) DO NOTHING')) {
                return Promise.resolve({ rows: [{ id: 'd2' }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const farmers = [{
            farmer_id: 'f-2', phone: '+265999333444', channels: ['whatsapp'],
            categories: ['dry_spell_warning'], lat: -13.9, lng: 33.7,
        }];
        await seasonalAdvisoryService.evaluateDistrict('Lilongwe', farmers, '2026-08-24');
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('never dispatches the same rule/district/day twice', async () => {
        mockGetDaily.mockResolvedValue(monthOfWetDays());
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes('ON CONFLICT (dedupe_hash) DO NOTHING')) {
                return Promise.resolve({ rows: [], rowCount: 0 }); // dedupe hit
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const farmers = [{
            farmer_id: 'f-3', phone: '+265999555666', channels: ['whatsapp'],
            categories: ['planting_window'], lat: -13.9, lng: 33.7,
        }];
        const fired = await seasonalAdvisoryService.evaluateDistrict('Lilongwe', farmers, '2026-08-24');
        expect(fired).toEqual([]);
        expect(mockSend).not.toHaveBeenCalled();
    });
});
