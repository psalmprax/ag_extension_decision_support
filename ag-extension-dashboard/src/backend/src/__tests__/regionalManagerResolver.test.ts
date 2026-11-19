jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import {
    resolveManagerFromCandidates,
    resolveRegionalManager,
} from '@/services/regionalManagerResolver';

interface ManagerRow {
    id: string;
    region: string | null;
    country: string | null;
}

const mockQuery = query as jest.MockedFunction<typeof query>;

const results = (rows: ManagerRow[]) => ({ rows, rowCount: rows.length });

const LILONGWE: ManagerRow = { id: 'rm-lilongwe', region: 'Lilongwe', country: 'Malawi' };
const KUMASI: ManagerRow = { id: 'rm-kumasi', region: 'Kumasi', country: 'Ghana' };

describe('resolveManagerFromCandidates', () => {
    it('prefers an exact region match', () => {
        expect(resolveManagerFromCandidates('Lilongwe', [LILONGWE, KUMASI])).toEqual({
            managerId: 'rm-lilongwe',
            matchedBy: 'exact',
            matchedRegion: 'Lilongwe',
        });
    });

    it('bridges the country-list spelling to the stored manager region', () => {
        // The signup form offers "Central Region (Lilongwe)"; the manager row says "Lilongwe".
        expect(resolveManagerFromCandidates('Central Region (Lilongwe)', [KUMASI, LILONGWE])).toEqual({
            managerId: 'rm-lilongwe',
            matchedBy: 'normalized',
            matchedRegion: 'Lilongwe',
        });
    });

    it('returns no manager when nothing matches', () => {
        expect(resolveManagerFromCandidates('Nairobi', [LILONGWE, KUMASI])).toEqual({
            managerId: null,
            matchedBy: 'none',
            matchedRegion: null,
        });
    });

    it('returns no manager for a missing or blank region', () => {
        expect(resolveManagerFromCandidates(null, [LILONGWE])).toEqual({ managerId: null, matchedBy: 'none', matchedRegion: null });
        expect(resolveManagerFromCandidates('   ', [LILONGWE])).toEqual({ managerId: null, matchedBy: 'none', matchedRegion: null });
    });

    it('ignores candidates whose region is unset', () => {
        expect(resolveManagerFromCandidates('Lilongwe', [{ id: 'rm-x', region: null, country: null }])).toEqual({
            managerId: null,
            matchedBy: 'none',
            matchedRegion: null,
        });
    });

    it('does not let a two-character fragment claim the account', () => {
        expect(resolveManagerFromCandidates('Central Region', [{ id: 'rm-x', region: 'CE', country: null }])).toEqual({
            managerId: null,
            matchedBy: 'none',
            matchedRegion: null,
        });
    });
});

describe('resolveRegionalManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('looks up real, active regional managers only, scoped by country', async () => {
        mockQuery.mockResolvedValue(results([LILONGWE]) as never);

        const resolution = await resolveRegionalManager('Lilongwe', 'Malawi');

        expect(resolution).toEqual({
            managerId: 'rm-lilongwe',
            matchedBy: 'exact',
            matchedRegion: 'Lilongwe',
        });
        const [sql, params] = mockQuery.mock.calls[0];
        expect(String(sql)).toContain("role = 'regional_manager'");
        // Demo managers must never receive a real officer's account.
        expect(String(sql)).toContain('COALESCE(is_demo, false) = false');
        expect(String(sql)).toContain('COALESCE(is_active, true) = true');
        expect(params).toEqual(['Malawi']);
    });

    it('skips the lookup entirely when no region was supplied', async () => {
        const resolution = await resolveRegionalManager(null, 'Malawi');

        expect(resolution).toEqual({ managerId: null, matchedBy: 'none', matchedRegion: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('degrades to "no manager" and logs when the lookup fails', async () => {
        mockQuery.mockRejectedValue(new Error('column "country" does not exist') as never);

        const resolution = await resolveRegionalManager('Lilongwe', 'Malawi');

        expect(resolution).toEqual({ managerId: null, matchedBy: 'none', matchedRegion: null });
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Regional manager lookup failed for region "Lilongwe"')
        );
    });

    it('passes a null country when the signup form omits it', async () => {
        mockQuery.mockResolvedValue(results([]) as never);

        await resolveRegionalManager('Kumasi', '  ');

        expect(mockQuery.mock.calls[0][1]).toEqual([null]);
    });
});
