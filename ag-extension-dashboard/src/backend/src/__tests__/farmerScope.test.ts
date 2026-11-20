jest.mock('@/services/messageAccessService', () => ({ resolvePrincipalRegion: jest.fn(async () => 'Rift Valley') }));
jest.mock('@/services/databaseService', () => ({ query: jest.fn(async () => ({ rows: [{ id: 'f1' }] })) }));

import { farmerScopeSql, rowsOfVisibleFarmersSql, visibleFarmerIds } from '@/services/access/farmerScope';

describe('one rule for whose farmers a person sees', () => {
    it('gives an administrator everyone (real records only)', async () => {
        expect(await farmerScopeSql({ userId: 'a', role: 'admin' })).toEqual({ sql: 'COALESCE(f.is_demo, false) = false', params: [] });
        expect(await visibleFarmerIds({ userId: 'a', role: 'admin' })).toBeNull();
    });

    it('gives a manager their region', async () => {
        expect(await farmerScopeSql({ userId: 'm', role: 'regional_manager' })).toEqual({
            sql: 'COALESCE(f.is_demo, false) = false AND f.region = $1',
            params: ['Rift Valley'],
        });
    });

    it('gives an officer their assigned farmers, numbering parameters after the caller’s', async () => {
        expect(await farmerScopeSql({ userId: 'o', role: 'extension_officer' }, 'x', 3)).toEqual({
            sql: 'COALESCE(x.is_demo, false) = false AND x.assigned_officer_id = $3',
            params: ['o'],
        });
    });

    it('gives a farmer only themselves, and anyone else no one', async () => {
        expect((await farmerScopeSql({ userId: 'u', role: 'farmer' })).sql).toContain('f.user_id = $1');
        expect((await farmerScopeSql({ userId: 'u', role: 'guest' })).sql).toContain('FALSE');
    });

    it('keeps demo sessions on demo records', async () => {
        expect((await farmerScopeSql({ userId: 'd', role: 'admin', isDemo: true })).sql).toBe('COALESCE(f.is_demo, false) = true');
    });

    it('applies to rows that point at a farmer', async () => {
        const scope = await rowsOfVisibleFarmersSql({ userId: 'o', role: 'extension_officer' }, 'v.farmer_id', 2);
        expect(scope.sql).toBe('EXISTS (SELECT 1 FROM farmers scope_f WHERE scope_f.id = v.farmer_id AND COALESCE(scope_f.is_demo, false) = false AND scope_f.assigned_officer_id = $2)');
    });
});
