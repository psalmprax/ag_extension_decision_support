/**
 * Moving farmers to another officer in bulk (when an officer leaves) follows the same rule as
 * the first assignment: only a manager or an administrator, only to an active, real officer,
 * and a manager only to an officer of their own region. Nothing else may be set in bulk except
 * the fields the bulk update form offers.
 */
const users: Record<string, { id: string; role: string; region: string | null; isActive: boolean; isDemo: boolean }> = {
    'manager-nakuru': { id: 'manager-nakuru', role: 'regional_manager', region: 'Rift Valley', isActive: true, isDemo: false },
    'officer-nakuru': { id: 'officer-nakuru', role: 'extension_officer', region: 'Rift Valley', isActive: true, isDemo: false },
    'officer-left': { id: 'officer-left', role: 'extension_officer', region: 'Rift Valley', isActive: false, isDemo: false },
    'officer-gone': { id: 'officer-gone', role: 'extension_officer', region: 'Rift Valley', isActive: false, isDemo: false },
    'officer-mzuzu': { id: 'officer-mzuzu', role: 'extension_officer', region: 'Northern Region (Mzuzu)', isActive: true, isDemo: false },
};
const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
const history: Array<Record<string, unknown>> = [];

jest.mock('../services/prismaService', () => ({
    getPrisma: () => ({
        $transaction: async (fn: (tx: unknown) => Promise<void>) => {
            const pendingUpdates: typeof updated = [];
            const pendingHistory: typeof history = [];
            const tx = {
                user: { findUnique: async ({ where }: { where: { id: string } }) => users[where.id] ?? null },
                farmer: {
                    findUnique: async ({ where }: { where: { id: string } }) => ({
                        id: where.id, assignedOfficerId: 'officer-left', userId: null, region: 'Rift Valley', tenantId: 't1',
                    }),
                    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { pendingUpdates.push({ id: where.id, data }); },
                },
                farmerAssignmentHistory: { create: async ({ data }: { data: Record<string, unknown> }) => { pendingHistory.push(data); } },
            };
            await fn(tx);
            updated.push(...pendingUpdates);
            history.push(...pendingHistory);
        },
    }),
}));
jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../services/country/countryContext', () => ({ farmerCountryFor: async (country?: string) => country || 'Kenya' }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { bulkOperationsService } from '../services/bulkOperationsService';

describe('bulkUpdateFarmers: moving farmers to another officer', () => {
    beforeEach(() => {
        updated.splice(0);
        history.splice(0);
    });

    it('lets a manager hand a farmer to an active officer of their region, and records it', async () => {
        const result = await bulkOperationsService.bulkUpdateFarmers({ ids: ['f1'], updates: { assignedOfficerId: 'officer-nakuru' } }, 'manager-nakuru', 'regional_manager');
        expect(result).toMatchObject({ success: true, processed: 1 });
        expect(updated[0]!.data).toMatchObject({ assignedOfficerId: 'officer-nakuru' });
        expect(history[0]).toMatchObject({ farmerId: 'f1', officerId: 'officer-nakuru', reassignedBy: 'manager-nakuru' });
    });

    it.each([
        ['an officer of another region', 'officer-mzuzu', 'own region'],
        ['an officer whose account was switched off', 'officer-gone', 'not available'],
        ['someone who is not an officer', 'manager-nakuru', 'not available'],
    ])('refuses a manager handing a farmer to %s', async (_who, officerId, message) => {
        const result = await bulkOperationsService.bulkUpdateFarmers({ ids: ['f1'], updates: { assignedOfficerId: officerId } }, 'manager-nakuru', 'regional_manager');
        expect(result).toMatchObject({ success: false, failed: 1 });
        expect(result.errors[0]).toContain(message);
        expect(updated).toHaveLength(0);
        expect(history).toHaveLength(0);
    });

    it('refuses an officer reassigning their own farmer', async () => {
        const result = await bulkOperationsService.bulkUpdateFarmers({ ids: ['f1'], updates: { assignedOfficerId: 'officer-nakuru' } }, 'officer-left', 'extension_officer');
        expect(result.errors[0]).toContain('Only a regional manager or an administrator');
        expect(updated).toHaveLength(0);
    });

    it('refuses fields the bulk form does not offer, such as the tenant', async () => {
        const result = await bulkOperationsService.bulkUpdateFarmers({ ids: ['f1'], updates: { tenantId: 'other-tenant', crops: ['maize'] } }, 'manager-nakuru', 'regional_manager');
        expect(result.errors[0]).toContain('cannot be changed in bulk: tenantId');
        expect(updated).toHaveLength(0);
    });

    it('still applies the form\'s own fields', async () => {
        const result = await bulkOperationsService.bulkUpdateFarmers({ ids: ['f1'], updates: { crops: ['maize', 'beans'], languagePreference: 'sw' } }, 'manager-nakuru', 'regional_manager');
        expect(result).toMatchObject({ success: true });
        expect(updated[0]!.data).toMatchObject({ crops: ['maize', 'beans'], languagePreference: 'sw' });
    });
});
