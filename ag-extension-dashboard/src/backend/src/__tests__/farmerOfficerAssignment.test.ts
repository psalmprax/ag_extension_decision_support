import { resolveCreationOfficer } from '../services/farmerOfficerAssignment';

type Row = { id: string; role: string; region: string | null; isActive: boolean | null; isDemo: boolean };

const OFFICER_ID = '22222222-2222-4222-8222-222222222222';

function prismaWith(users: Row[]) {
    const findUnique = jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(users.find(u => u.id === where.id) ?? null));
    return { user: { findUnique } } as unknown as Parameters<typeof resolveCreationOfficer>[0];
}

const manager: Row = { id: 'rm-1', role: 'regional_manager', region: 'Rift Valley', isActive: true, isDemo: false };
const officer = (over: Partial<Row> = {}): Row => ({
    id: OFFICER_ID, role: 'extension_officer', region: 'Rift Valley', isActive: true, isDemo: false, ...over,
});

describe('resolveCreationOfficer', () => {
    it('assigns an extension officer\'s farmer to that officer, ignoring any requested officer', async () => {
        const result = await resolveCreationOfficer(prismaWith([]), { userId: 'off-1', role: 'extension_officer' }, OFFICER_ID, 'Central');
        expect(result).toEqual({ ok: true, officerId: 'off-1' });
    });

    it('leaves the farmer unassigned when an admin names no officer', async () => {
        const result = await resolveCreationOfficer(prismaWith([]), { userId: 'admin-1', role: 'admin' }, undefined, 'Central');
        expect(result).toEqual({ ok: true, officerId: null });
    });

    it('lets an admin assign an active officer in any region', async () => {
        const result = await resolveCreationOfficer(prismaWith([officer({ region: 'Coast' })]), { userId: 'admin-1', role: 'admin' }, OFFICER_ID, 'Central');
        expect(result).toEqual({ ok: true, officerId: OFFICER_ID });
    });

    it.each([
        ['a non-officer', { role: 'regional_manager' }],
        ['a deactivated officer', { isActive: false }],
        ['a demo officer', { isDemo: true }],
    ])('refuses %s', async (_label, over) => {
        const result = await resolveCreationOfficer(prismaWith([officer(over)]), { userId: 'admin-1', role: 'admin' }, OFFICER_ID, 'Central');
        expect(result).toMatchObject({ ok: false, status: 400, code: 'OFFICER_NOT_ASSIGNABLE' });
    });

    it('refuses an unknown officer id', async () => {
        const result = await resolveCreationOfficer(prismaWith([]), { userId: 'admin-1', role: 'admin' }, OFFICER_ID, 'Central');
        expect(result).toMatchObject({ ok: false, code: 'OFFICER_NOT_ASSIGNABLE' });
    });

    it('lets a regional manager assign an officer from their own region', async () => {
        const result = await resolveCreationOfficer(prismaWith([manager, officer()]), { userId: 'rm-1', role: 'regional_manager' }, OFFICER_ID, 'Rift Valley');
        expect(result).toEqual({ ok: true, officerId: OFFICER_ID });
    });

    it('refuses a regional manager assigning an officer from another region', async () => {
        const result = await resolveCreationOfficer(prismaWith([manager, officer({ region: 'Coast' })]), { userId: 'rm-1', role: 'regional_manager' }, OFFICER_ID, 'Rift Valley');
        expect(result).toMatchObject({ ok: false, status: 403, code: 'OFFICER_OUTSIDE_MANAGER_REGION' });
    });

    it('refuses a regional manager registering a farmer outside their region', async () => {
        const result = await resolveCreationOfficer(prismaWith([manager, officer()]), { userId: 'rm-1', role: 'regional_manager' }, OFFICER_ID, 'Coast');
        expect(result).toMatchObject({ ok: false, status: 403, code: 'FARMER_OUTSIDE_MANAGER_REGION' });
    });

    it('refuses a regional manager with no region on file', async () => {
        const result = await resolveCreationOfficer(prismaWith([{ ...manager, region: null }]), { userId: 'rm-1', role: 'regional_manager' }, undefined, 'Rift Valley');
        expect(result).toMatchObject({ ok: false, code: 'FARMER_OUTSIDE_MANAGER_REGION' });
    });

    it('lets a regional manager leave the farmer unassigned in their own region', async () => {
        const result = await resolveCreationOfficer(prismaWith([manager]), { userId: 'rm-1', role: 'regional_manager' }, '', 'Rift Valley');
        expect(result).toEqual({ ok: true, officerId: null });
    });
});
