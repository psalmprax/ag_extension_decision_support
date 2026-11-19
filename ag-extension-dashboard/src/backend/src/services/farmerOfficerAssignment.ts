import { getPrisma } from '@/services/prismaService';

type Prisma = ReturnType<typeof getPrisma>;

interface Creator {
    userId?: string;
    role?: string;
}

export type OfficerAssignment =
    | { ok: true; officerId: string | null }
    | { ok: false; status: number; error: string; code: string };

interface OfficerRow {
    id: string;
    role: string | null;
    region: string | null;
    isActive: boolean | null;
    isDemo: boolean | null;
}

function refuse(status: number, code: string, error: string): OfficerAssignment {
    return { ok: false, status, code, error };
}

async function accountRegion(prisma: Prisma, userId: string): Promise<string> {
    const account = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
    return account?.region ?? '';
}

async function findOfficer(prisma: Prisma, officerId: string): Promise<OfficerRow | null> {
    return prisma.user.findUnique({
        where: { id: officerId },
        select: { id: true, role: true, region: true, isActive: true, isDemo: true },
    }) as Promise<OfficerRow | null>;
}

/** An officer's farmers are their own, in the officer's region when one is on file. */
async function officerOwnFarmer(prisma: Prisma, officerId: string, farmerRegion: unknown): Promise<OfficerAssignment> {
    const officerRegion = await accountRegion(prisma, officerId);
    if (officerRegion && farmerRegion !== officerRegion) {
        return refuse(403, 'FARMER_OUTSIDE_OFFICER_REGION',
            'Extension officers can only register farmers in their own region');
    }
    return { ok: true, officerId };
}

/**
 * Decides which extension officer a newly registered farmer is assigned to.
 *
 * - An extension officer's farmers are always theirs, and registered in the
 *   officer's own region (an officer with no region on file is not limited).
 * - An admin may name any active, real extension officer.
 * - A regional manager registers farmers in their own region only, and may
 *   name only an active, real extension officer from that region — otherwise
 *   a manager could hand farmers to staff they do not supervise, and the
 *   farmer would drop out of the manager's own (region-scoped) list.
 */
export async function resolveCreationOfficer(
    prisma: Prisma,
    creator: Creator,
    requestedOfficerId: unknown,
    farmerRegion: unknown
): Promise<OfficerAssignment> {
    const { role, userId } = creator;
    if (role === 'extension_officer' && userId) return officerOwnFarmer(prisma, userId, farmerRegion);
    if (role !== 'admin' && role !== 'regional_manager') return { ok: true, officerId: null };

    const region = role === 'regional_manager' && userId ? await accountRegion(prisma, userId) : null;
    if (region !== null && (!region || farmerRegion !== region)) {
        return refuse(403, 'FARMER_OUTSIDE_MANAGER_REGION',
            'Regional managers can only register farmers in their own region');
    }

    if (typeof requestedOfficerId !== 'string' || !requestedOfficerId) return { ok: true, officerId: null };

    const officer = await findOfficer(prisma, requestedOfficerId);
    const usable = officer && officer.role === 'extension_officer'
        && officer.isActive !== false && officer.isDemo !== true;
    if (!usable) {
        return refuse(400, 'OFFICER_NOT_ASSIGNABLE', 'The selected extension officer is not available');
    }
    if (region !== null && officer.region !== region) {
        return refuse(403, 'OFFICER_OUTSIDE_MANAGER_REGION',
            'Regional managers can only assign officers from their own region');
    }
    return { ok: true, officerId: officer.id };
}
