import express from 'express';
import request from 'supertest';
import usersRouter from '@/routes/users';
import farmersRouter from '@/routes/farmers';
import { getPrisma } from '@/services/prismaService';
import { query } from '@/services/databaseService';
import { farmerRecordFilter } from '@/services/demoRecordScope';

jest.mock('@/middleware/authorize', () => ({
    authorize: (roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const role = req.header('X-Test-Role') || 'admin';
        if (!roles.includes(role)) return res.status(403).json({ success: false });
        req.user = {
            userId: 'test-user',
            role: role as 'admin' | 'regional_manager' | 'extension_officer' | 'farmer',
            email: req.header('X-Test-Email') || 'admin@example.test',
            isDemo: req.header('X-Test-Demo') === 'true',
            tenantId: 'tenant-1',
        };
        next();
    },
}));
jest.mock('@/services/prismaService', () => {
    const prisma = {
        farmer: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
        user: { findUnique: jest.fn().mockResolvedValue({ region: 'Central' }) },
    };
    return { getPrisma: jest.fn(() => prisma) };
});
jest.mock('@/services/databaseService', () => ({
    getPool: jest.fn(() => ({})),
    query: jest.fn().mockResolvedValue({ rows: [] }),
}));
jest.mock('@/services/dataGovernanceService', () => ({
    getPrincipalTenantId: jest.fn().mockResolvedValue('tenant-1'),
}));
jest.mock('@/services/sessionService', () => ({ revokeAllUserSessions: jest.fn() }));
jest.mock('@/services/shareService', () => ({ shareService: {} }));
jest.mock('@/utils/logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/users', usersRouter);
app.use('/farmers', farmersRouter);
const findFarmers = getPrisma().farmer.findMany as jest.Mock;
const mockQuery = query as jest.Mock;

describe('Admin demo record inspection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockResolvedValue({ rows: [] });
    });

    it.each(['', '?dataset=live'])('excludes demo users by default and for explicit live scope: %s', async suffix => {
        expect((await request(app).get(`/users${suffix}`)).status).toBe(200);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE COALESCE(is_demo, false) = $1'), [false]);
    });

    it('allows an admin to explicitly inspect only demo users', async () => {
        expect((await request(app).get('/users?dataset=demo')).status).toBe(200);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE COALESCE(is_demo, false) = $1'), [true]);
    });

    it.each(['live', 'demo'])('preserves %s scope in the legacy user-column fallback', async dataset => {
        mockQuery.mockRejectedValueOnce({ code: '42703', message: 'country column missing' });
        expect((await request(app).get(`/users?dataset=${dataset}`)).status).toBe(200);
        expect(mockQuery).toHaveBeenCalledTimes(2);
        for (const [sql, values] of mockQuery.mock.calls) {
            expect(sql).toContain('WHERE COALESCE(is_demo, false) = $1');
            expect(values).toEqual([dataset === 'demo']);
        }
    });

    it.each(['/users', '/farmers', '/farmers/export'])('rejects invalid scope on %s before data access', async path => {
        expect((await request(app).get(`${path}?dataset=all`)).status).toBe(400);
        expect(mockQuery).not.toHaveBeenCalled();
        expect(findFarmers).not.toHaveBeenCalled();
    });

    it.each(['/users', '/farmers'])('denies non-admin demo inspection on %s', async path => {
        expect((await request(app).get(`${path}?dataset=demo`).set('X-Test-Role', 'regional_manager')).status).toBe(403);
        expect(mockQuery).not.toHaveBeenCalled();
        expect(findFarmers).not.toHaveBeenCalled();
    });

    it.each(['/users', '/farmers'])('denies demo principals access to %s', async path => {
        expect((await request(app).get(path).set('X-Test-Demo', 'true')).status).toBe(403);
        expect(mockQuery).not.toHaveBeenCalled();
        expect(findFarmers).not.toHaveBeenCalled();
    });

    it('also recognizes the legacy demo email', async () => {
        expect((await request(app).get('/farmers').set('X-Test-Email', 'demo@agridemo.com')).status).toBe(403);
        expect(findFarmers).not.toHaveBeenCalled();
    });

    it('excludes seeded demo farmers and farmers attached to demo accounts from operational search', async () => {
        expect((await request(app).get('/farmers?search=Jane&region=Central')).status).toBe(200);
        expect(findFarmers).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                AND: [farmerRecordFilter(false)],
                region: 'Central',
                OR: expect.arrayContaining([{ firstName: { contains: 'Jane', mode: 'insensitive' } }]),
            }),
        }));
        expect(farmerRecordFilter(false)).toEqual({
            NOT: { OR: [
                { isDemo: true },
                { user: { is: { isDemo: true } } },
                { assignedOfficer: { is: { isDemo: true } } },
            ] },
        });
    });

    it('preserves tenant and officer restrictions when excluding demo farmers', async () => {
        expect((await request(app).get('/farmers').set('X-Test-Role', 'extension_officer')).status).toBe(200);
        expect(findFarmers).toHaveBeenCalledWith(expect.objectContaining({
            where: { AND: [farmerRecordFilter(false)], isDemo: false, tenantId: 'tenant-1', assignedOfficerId: 'test-user' },
        }));
    });

    it('keeps demo farmer inspection paginated and supports mobile responses', async () => {
        expect((await request(app).get('/farmers?dataset=demo&limit=50&offset=50&mobile=true')).status).toBe(200);
        expect(findFarmers).toHaveBeenCalledWith(expect.objectContaining({
            where: { AND: [farmerRecordFilter(true)] }, take: 50, skip: 50,
        }));
    });

    it('keeps CSV exports live-only and reaches the export route rather than the ID route', async () => {
        const response = await request(app).get('/farmers/export');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
        expect(findFarmers).toHaveBeenCalledWith(expect.objectContaining({
            where: { AND: [farmerRecordFilter(false)], isDemo: false },
        }));
    });

    it('does not export demo records even for administrators', async () => {
        expect((await request(app).get('/farmers/export?dataset=demo')).status).toBe(400);
        expect(findFarmers).not.toHaveBeenCalled();
    });
});
