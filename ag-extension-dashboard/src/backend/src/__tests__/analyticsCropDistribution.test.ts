const mockQuery = jest.fn();
jest.mock('@/services/databaseService', () => ({
    query: (...args: unknown[]) => mockQuery(...args),
    getPool: () => ({}),
}));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { fetchCropDistribution, type UserScope } from '@/routes/analytics';

const officer: UserScope = { isOfficer: true, isManager: false, officerId: 'officer-1', managerRegion: null, tenantId: null };

/**
 * The dashboard's crop bars read a farmer count. The route used to send only a share of
 * crop mentions, so the chart drew empty bars with no numbers for every officer.
 */
describe('crop distribution on the dashboard', () => {
    beforeEach(() => mockQuery.mockReset());

    it('counts farmers per crop and their share of farmers with crops', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ crop: 'maize', count: '4' }, { crop: 'beans', count: '1' }] })
            .mockResolvedValueOnce({ rows: [{ total: '5' }] });

        const crops = await fetchCropDistribution(officer);

        expect(crops).toEqual([
            { name: 'maize', count: 4, percentage: 80 },
            { name: 'beans', count: 1, percentage: 20 },
        ]);
        // Scoped to the officer's own farmers, and case-folded so "Maize" and "maize" are one crop.
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('LOWER(TRIM(crop))');
        expect(sql).toContain('COUNT(DISTINCT f.id)');
        expect(params).toEqual(['officer-1']);
    });

    it('gives a zero share when no farmer has crops', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] });
        await expect(fetchCropDistribution(officer)).resolves.toEqual([]);
    });
});
