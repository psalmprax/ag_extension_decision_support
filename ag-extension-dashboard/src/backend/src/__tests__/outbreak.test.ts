import { outbreakService, K_ANONYMITY_MIN, ALERT_THRESHOLD } from '../services/outbreakService';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() } }));

const mockQuery = query as jest.Mock;

describe('outbreakService', () => {
    beforeEach(() => mockQuery.mockReset());

    it('records diagnosis events with district and source', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        await outbreakService.recordDiagnosisEvent({
            farmerId: 'f-1', district: 'Lilongwe', crop: 'maize', diseaseLabel: 'fall_armyworm', confidence: 0.92,
        });
        const call = mockQuery.mock.calls[0];
        expect(String(call[0])).toMatch(/INSERT INTO diagnosis_events/);
        expect(call[1]).toEqual(['f-1', 'Lilongwe', 'maize', 'fall_armyworm', 0.92, 'extension_tool']);
    });

    it('enforces the k-anonymity floor in SQL and never surfaces smaller clusters', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { district: 'Lilongwe', crop: 'maize', disease_label: 'fall_armyworm', case_count: '9', distinct_farmers: '5', first_seen: new Date(), last_seen: new Date() },
            ],
            rowCount: 1,
        });
        const clusters = await outbreakService.getClusters({ days: 14 });
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toMatch(/HAVING COUNT\(DISTINCT de\.farmer_id\) >= \$2/);
        expect(mockQuery.mock.calls[0][1]).toContain(K_ANONYMITY_MIN);
        expect(clusters[0].caseCount).toBe(9);
        expect(clusters[0].distinctFarmers).toBe(5);
    });

    it('flags clusters at or above the alert threshold', async () => {
        const cluster = { district: 'Lilongwe', crop: 'maize', diseaseLabel: 'fall_armyworm', caseCount: ALERT_THRESHOLD, distinctFarmers: 5, firstSeen: new Date(), lastSeen: new Date(), centroid: { lat: -13.9, lng: 33.7 } };
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        jest.spyOn(outbreakService, 'getClusters').mockResolvedValueOnce([
            cluster,
            { ...cluster, caseCount: ALERT_THRESHOLD - 1, district: 'Salima' },
        ]);
        const alerted = await outbreakService.getAlertedDistricts();
        expect(alerted).toHaveLength(1);
        expect(alerted[0].district).toBe('Lilongwe');
    });

    it('falls back to same-region adjacency when the curated table is empty', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ district: 'Salima' }, { district: 'Dedza' }], rowCount: 2 });

        const adjacent = await outbreakService.getAdjacentDistricts('Lilongwe');
        expect(adjacent).toEqual(['Salima', 'Dedza']);
        expect(String(mockQuery.mock.calls[1][0])).toMatch(/f1\.region = f2\.region/);
    });

    it('uses the curated adjacency table when populated', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ adjacent_district: 'Mchinji' }], rowCount: 1 });
        const adjacent = await outbreakService.getAdjacentDistricts('Lilongwe');
        expect(adjacent).toEqual(['Mchinji']);
        expect(mockQuery.mock.calls.length).toBe(1);
    });

    it('emails officers in affected and adjacent districts during rollup', async () => {
        const cluster = { district: 'Lilongwe', crop: 'maize', diseaseLabel: 'fall_armyworm', caseCount: 12, distinctFarmers: 7, firstSeen: new Date(), lastSeen: new Date(), centroid: { lat: -13.9, lng: 33.7 } };
        jest.spyOn(outbreakService, 'getAlertedDistricts').mockResolvedValueOnce([cluster]);
        jest.spyOn(outbreakService, 'getOfficersToWarn').mockResolvedValueOnce(['a@e.com', 'b@e.com']);

        const emails: string[] = [];
        const sent = await outbreakService.rollupAndNotify(async (to) => { emails.push(to); });
        expect(sent).toBe(2);
        expect(emails).toEqual(['a@e.com', 'b@e.com']);
    });
});
