jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/notify/farmerNotices', () => ({
    sendFarmerNotice: jest.fn().mockResolvedValue('sent'),
    visitDateText: () => 'Tue, 25 Nov',
}));
jest.mock('@/services/messageAccessService', () => ({ resolvePrincipalRegion: jest.fn().mockResolvedValue('Mzuzu') }));

import { query } from '@/services/databaseService';
import { sendFarmerNotice } from '@/services/notify/farmerNotices';
import { assignArms, createPilot, PilotError, startPilot } from '@/services/pilots/pilots';
import { parseAnswer, parseYield, takePilotReply } from '@/services/pilots/pilotReplies';
import { armUse, armYields, differenceInChange } from '@/services/pilots/results';
import { sendDueFollowUps } from '@/services/pilots/followups';

const mockQuery = query as jest.Mock;
beforeEach(() => { mockQuery.mockReset(); jest.clearAllMocks(); });

describe('random split', () => {
    it('puts the chosen share in the comparison group and everyone in one group', () => {
        const farmers = Array.from({ length: 100 }, (_, i) => i);
        const arms = assignArms(farmers, 0.5);
        expect(arms.filter(a => a.arm === 'comparison')).toHaveLength(50);
        expect(new Set(arms.map(a => a.item)).size).toBe(100);
    });

    it('depends on the random source, not on the order farmers were registered', () => {
        const farmers = ['a', 'b', 'c', 'd'];
        const first = assignArms(farmers, 0.5, () => 0).map(a => `${a.item}:${a.arm}`);
        const second = assignArms(farmers, 0.5, max => max - 1).map(a => `${a.item}:${a.arm}`);
        expect(first).not.toEqual(second);
    });
});

describe('farmers’ replies', () => {
    it('reads a harvest in kg or in bags of the pilot’s size', () => {
        expect(parseYield('YIELD 900', 90)).toBe(900);
        expect(parseYield('yield 10 bags', 90)).toBe(900);
        expect(parseYield('MAVUNO 12 magunia', 50)).toBe(600);
        expect(parseYield('YIELD lots', 90)).toBeNull();
    });

    it('reads yes, partly and no in the farmer’s language', () => {
        expect(parseAnswer('Ndio')).toBe('yes');
        expect(parseAnswer('en partie')).toBe('partly');
        expect(parseAnswer('NAO')).toBe('no');
        expect(parseAnswer('no rain this week')).toBeNull();
    });

    it('records last season’s harvest before the season ends, and thanks the farmer', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ pilot_id: 'p1', season_end: '2027-03-31', bag_kg: 90 }] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(takePilotReply('f1', 'YIELD 8 BAGS', new Date('2026-12-01'))).resolves.toBe(true);
        expect(mockQuery.mock.calls[1][0]).toContain('SET baseline_kg');
        expect(mockQuery.mock.calls[1][1]).toEqual(['p1', 'f1', 720]);
        expect(sendFarmerNotice).toHaveBeenCalledWith('f1', 'harvest_thanks', { kg: '720' }, { always: true });
    });

    it('records this season’s harvest after the season ends', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ pilot_id: 'p1', season_end: '2027-03-31', bag_kg: 90 }] })
            .mockResolvedValueOnce({ rows: [] });
        await takePilotReply('f1', 'YIELD 1100', new Date('2027-04-10'));
        expect(mockQuery.mock.calls[1][0]).toContain('SET endline_kg');
    });

    it('leaves an ordinary "no" to the officer alone when no question is waiting', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ pilot_id: 'p1', season_end: '2027-03-31', bag_kg: 90 }] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(takePilotReply('f1', 'no')).resolves.toBe(false);
        expect(sendFarmerNotice).not.toHaveBeenCalled();
    });

    it('ignores farmers who are not in a running pilot', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(takePilotReply('f9', 'YIELD 900')).resolves.toBe(false);
    });
});

describe('follow-up questions', () => {
    it('are dropped, not retried, when the farmer has turned notices off', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'a1', farmer_id: 'f1', advised_at: new Date(), language_preference: 'en', country: 'Malawi' }] })
            .mockResolvedValueOnce({ rows: [] });
        (sendFarmerNotice as jest.Mock).mockResolvedValueOnce('opted_out');
        await expect(sendDueFollowUps()).resolves.toBe(0);
        expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM advice_followups');
    });
});

describe('results', () => {
    it('compares the change in kg per hectare between the groups, leaving out farms without a size', () => {
        const rows = [
            { arm: 'service' as const, baseline_kg: 1000, endline_kg: 1400, area_ha: 1 },
            { arm: 'service' as const, baseline_kg: 2000, endline_kg: 2600, area_ha: 2 },
            { arm: 'service' as const, baseline_kg: 500, endline_kg: 900, area_ha: null },
            { arm: 'comparison' as const, baseline_kg: 1000, endline_kg: 1100, area_ha: 1 },
            { arm: 'comparison' as const, baseline_kg: 1000, endline_kg: 1200, area_ha: 1 },
        ];
        const service = armYields(rows, 'service');
        const comparison = armYields(rows, 'comparison');
        expect(service.changes).toEqual([400, 300]);
        const difference = differenceInChange(service.changes, comparison.changes)!;
        expect(difference.kgPerHa).toBe(200);
        expect(difference.low).toBeLessThan(200);
        expect(difference.high).toBeGreaterThan(200);
    });

    it('gives no difference until both groups have at least two farmers with both harvests', () => {
        expect(differenceInChange([100], [50, 60])).toBeNull();
    });

    it('reports each group’s visits, messages, replies and advice within the season', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [
            { arm: 'service', visits: '14', farmers_visited: '9', farmer_messages: '40', farmers_messaging: '12', officer_replies: '31', ai_replies: '6', advice_recorded: '8', advice_reviewed: '3' },
            { arm: 'comparison', visits: '2', farmers_visited: '2', farmer_messages: '0', farmers_messaging: '0', officer_replies: '0', ai_replies: '0', advice_recorded: '0', advice_reviewed: '0' },
        ] });
        const use = await armUse('p1');
        expect(use.service).toEqual({ visits: 14, farmersVisited: 9, farmerMessages: 40, farmersMessaging: 12, officerReplies: 31, aiReplies: 6, adviceRecorded: 8, adviceReviewed: 3 });
        expect(use.comparison.visits).toBe(2);
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("vi.status = 'completed'");
        expect(sql).toContain('season.to_at');
    });
});

describe('setting up a pilot', () => {
    it('keeps a manager to their own region', async () => {
        await expect(createPilot({ userId: 'm1', role: 'regional_manager' }, {
            name: 'Maize 2027', region: 'Lilongwe', crop: 'maize', seasonStart: '2026-11-01', seasonEnd: '2027-04-30',
        })).rejects.toThrow(PilotError);
    });

    it('splits the region’s real farmers and starts the pilot', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'p1', status: 'draft', region: 'Mzuzu', country: 'Malawi', comparison_share: 0.5 }] })
            .mockResolvedValueOnce({ rows: [{ id: 'f1', farm_size_hectares: 1 }, { id: 'f2', farm_size_hectares: 2 }, { id: 'f3', farm_size_hectares: null }, { id: 'f4', farm_size_hectares: 1.5 }] })
            .mockResolvedValue({ rows: [] });
        await expect(startPilot({ userId: 'm1', role: 'regional_manager' }, 'p1')).resolves.toEqual({ service: 2, comparison: 2 });
        expect(mockQuery.mock.calls[1][0]).toContain('is_demo');
        expect(mockQuery.mock.calls.at(-1)?.[0]).toContain("status = 'running'");
    });
});
