import express from 'express';
import request from 'supertest';
import { query } from '../services/databaseService';
import { getFarmerForPrincipal, getPrincipalTenantId } from '../services/dataGovernanceService';

jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../services/dataGovernanceService', () => ({
    getFarmerForPrincipal: jest.fn(),
    getPrincipalTenantId: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
// The caller's identity comes from test headers; the real middleware is covered elsewhere.
jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { userId: String(req.headers['x-user']), role: String(req.headers['x-role']) } as express.Request['user'];
        next();
    },
}));

import reviewsRouter from '../routes/recommendationReviews';

const app = express();
app.use(express.json());
app.use('/ai/reviews', reviewsRouter);

const mockQuery = query as jest.Mock;
const mockFarmer = getFarmerForPrincipal as jest.Mock;
const mockTenant = getPrincipalTenantId as jest.Mock;

const as = (role: string, user = 'u-' + role) => ({ 'x-role': role, 'x-user': user });

beforeEach(() => {
    mockQuery.mockReset();
    mockFarmer.mockReset().mockResolvedValue({ id: 'f1', tenant_id: 't1' });
    mockTenant.mockReset().mockResolvedValue('t1');
});

describe('recommendation reviews', () => {
    it('lets an officer list the pending queue, including why each item was queued', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r1', trigger: 'no_sources', status: 'pending' }] });
        const res = await request(app).get('/ai/reviews').set(as('extension_officer'));
        expect(res.status).toBe(200);
        expect(res.body.data[0].trigger).toBe('no_sources');
        expect(mockQuery.mock.calls[0][0]).toContain('trigger');
        // Only reviews about the officer's own farmers (or about no farmer).
        expect(mockQuery.mock.calls[0][0]).toContain('assigned_officer_id = $3');
        expect(mockQuery.mock.calls[0][1]).toEqual(['t1', 'pending', expect.any(String)]);
    });

    it('does not let a farmer list the queue (it holds other farmers\' advice)', async () => {
        const res = await request(app).get('/ai/reviews').set(as('farmer'));
        expect(res.status).toBe(403);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('records a farmer\'s own review request as farmer_request', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r2', trigger: 'farmer_request' }] });
        const res = await request(app).post('/ai/reviews').set(as('farmer'))
            .send({ farmerId: 'f1', recommendation: 'Spray every three days' });
        expect(res.status).toBe(201);
        expect(mockQuery.mock.calls[0][1]).toEqual(['t1', 'f1', null, 'u-farmer', 'Spray every three days', null, 'no_verified_source', 'farmer_request']);
    });

    it('does not let a farmer decide a review', async () => {
        const res = await request(app).patch('/ai/reviews/r1').set(as('farmer'))
            .send({ status: 'approved', disposition: 'Looks fine to me' });
        expect(res.status).toBe(403);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('refuses to let the submitter sign off their own item (four eyes)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ farmer_id: 'f1', created_by: 'officer-a' }] });
        const res = await request(app).patch('/ai/reviews/r1').set(as('extension_officer', 'officer-a'))
            .send({ status: 'approved', disposition: 'Checked against the label rate' });
        expect(res.status).toBe(403);
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('lets a different reviewer decide, and the update itself also excludes the submitter', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ farmer_id: 'f1', created_by: 'officer-a' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', status: 'escalated', disposition: 'Needs a crop protection specialist' }] });
        const res = await request(app).patch('/ai/reviews/r1').set(as('regional_manager', 'manager-b'))
            .send({ status: 'escalated', disposition: 'Needs a crop protection specialist' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('escalated');
        expect(mockQuery.mock.calls[1][0]).toContain('created_by <> $3');
        expect(mockQuery.mock.calls[1][1]).toEqual(['escalated', 'Needs a crop protection specialist', 'manager-b', 'r1']);
    });

    it('requires a written disposition', async () => {
        const res = await request(app).patch('/ai/reviews/r1').set(as('admin'))
            .send({ status: 'approved', disposition: '' });
        expect(res.status).toBe(400);
    });
});
