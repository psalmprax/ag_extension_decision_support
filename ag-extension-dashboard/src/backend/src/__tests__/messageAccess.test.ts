import { checkMessageAccess, MessageAccessError } from '../services/messageAccessService';

jest.mock('../services/databaseService', () => ({
    query: jest.fn(),
}));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

const officer = { userId: 'off-1', role: 'extension_officer' as const };
const manager = { userId: 'mgr-1', role: 'regional_manager' as const, region: 'Central' };
const admin = { userId: 'admin-1', role: 'admin' as const };

const assignedFarmer = { farmer_id: 'farm-1', assigned_officer_id: 'off-1', user_id: null, region: 'Central', tenant_id: null, is_active: true };
const otherFarmer = { farmer_id: 'farm-2', assigned_officer_id: 'off-2', user_id: null, region: 'Central', tenant_id: null, is_active: true };

describe('message write-scope guard', () => {
    beforeEach(() => mockQuery.mockReset());

    it('allows an officer to message their assigned farmer (resolve by phone)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [assignedFarmer], rowCount: 1 });
        const farmerId = await checkMessageAccess(officer, { phone: '+254712345601' });
        expect(farmerId).toBe('farm-1');
    });

    it('blocks an officer messaging a farmer assigned to another officer', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [otherFarmer], rowCount: 1 });
        await expect(checkMessageAccess(officer, { farmerId: 'farm-2' })).rejects.toThrow(MessageAccessError);
    });

    it('blocks an officer messaging an unmapped number entirely', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        await expect(checkMessageAccess(officer, { phone: '+254799000000' })).rejects.toThrow(MessageAccessError);
    });

    it('allows admin to message an unmapped number', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const farmerId = await checkMessageAccess(admin, { phone: '+254799000000' });
        expect(farmerId).toBeNull();
    });

    it('blocks an officer messaging a farmer outside their region for a manager role', async () => {
        const southernOther = { farmer_id: 'farm-3', assigned_officer_id: 'off-2', user_id: null, region: 'Southern', tenant_id: null, is_active: true };
        mockQuery.mockResolvedValueOnce({ rows: [southernOther], rowCount: 1 });
        await expect(checkMessageAccess(manager, { farmerId: 'farm-3' })).rejects.toThrow(MessageAccessError);
    });

    it('allows a regional manager to message a farmer in their region', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ ...otherFarmer, region: 'Central' }], rowCount: 1 });
        const farmerId = await checkMessageAccess(manager, { farmerId: 'farm-2' });
        expect(farmerId).toBe('farm-2');
    });
});