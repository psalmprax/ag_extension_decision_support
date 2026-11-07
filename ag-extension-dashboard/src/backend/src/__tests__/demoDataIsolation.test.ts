import express from 'express';
import request from 'supertest';
import fieldsRouter from '@/routes/fields';
import analyticsRouter from '@/routes/analytics';
import { getPrisma } from '@/services/prismaService';
import { query } from '@/services/databaseService';
import { cacheGet } from '@/services/cacheService';

jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = {
            userId: 'demo-officer',
            role: 'admin',
            email: 'test@example.com',
            isDemo: req.header('X-Test-Demo') === 'true',
        };
        next();
    },
}));
jest.mock('@/services/prismaService', () => ({ getPrisma: jest.fn() }));
jest.mock('@/services/databaseService', () => ({
    getPool: jest.fn(() => ({})),
    query: jest.fn().mockResolvedValue({ rows: [] }),
}));
jest.mock('@/services/cacheService', () => ({
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/dataGovernanceService', () => ({
    getPrincipalTenantId: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/utils/logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/fields', fieldsRouter);
app.use('/analytics', analyticsRouter);

describe('Demo and live data separation', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([
        ['post', '/fields'],
        ['put', '/fields/field-1'],
        ['delete', '/fields/field-1'],
        ['post', '/fields/field-1/cycles'],
        ['patch', '/fields/field-1/cycles/cycle-1'],
    ] as const)('rejects demo %s %s before touching the database', async (method, path) => {
        const response = await request(app)[method](path).set('X-Test-Demo', 'true').send({});
        expect(response.status).toBe(403);
        expect(response.body.error).toContain('read-only');
        expect(getPrisma).not.toHaveBeenCalled();
    });

    it('does not change validation behavior for ordinary field users', async () => {
        const response = await request(app).post('/fields').send({});
        expect(response.status).toBe(400);
    });

    it('rejects demo access to live dashboard data before database/cache access', async () => {
        const response = await request(app).get('/analytics/dashboard').set('X-Test-Demo', 'true');
        expect(response.status).toBe(403);
        expect(query).not.toHaveBeenCalled();
        expect(cacheGet).not.toHaveBeenCalled();
    });

    it('excludes seeded demo farmers and dependent records throughout live dashboard queries', async () => {
        const response = await request(app).get('/analytics/dashboard');
        expect(response.status).toBe(200);
        const queries = jest.mocked(query).mock.calls.map(([sql]) => String(sql));
        expect(queries.length).toBeGreaterThan(10);
        for (const sql of queries) {
            expect(sql).toContain('is_demo');
        }
        expect(cacheGet).toHaveBeenCalledWith('analytics:dashboard:live-v2:legacy:global');
    });

    it('excludes demo records from performance aggregates and officer joins', async () => {
        const response = await request(app).get('/analytics/performance');
        expect(response.status).toBe(200);
        const queries = jest.mocked(query).mock.calls.map(([sql]) => String(sql));
        for (const sql of queries) expect(sql).toContain('is_demo');
        const officerQuery = queries.find(sql => sql.includes('LEFT JOIN visits'));
        expect(officerQuery).toContain('live_f.id = v.farmer_id');
        expect(officerQuery).toContain('live_f.id = c.farmer_id');
        expect(cacheGet).toHaveBeenCalledWith('analytics:performance:live-v2:legacy:month:all:all');
    });
});
