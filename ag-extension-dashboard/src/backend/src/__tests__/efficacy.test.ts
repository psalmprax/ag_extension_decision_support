import request from 'supertest';
import app from '../app';
import crypto from 'crypto';

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { headers?: { authorization?: string }; user?: unknown }, res: { status: (c: number) => { json: (b: unknown) => void } }, next: () => void) => {
        const header = req.headers?.authorization || '';
        const token = header.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({ success: false, error: 'No token provided' });
            return;
        }
        const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        req.user = payload;
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const officerAuth = { userId: 'off-1', role: 'extension_officer', email: 'o@e.com' };
const token = Buffer.from(JSON.stringify(officerAuth)).toString('base64');
const officerHeader = { Authorization: `Bearer ${token}` };

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

const validOutcome = {
    visitId: crypto.randomUUID(),
    farmerId: crypto.randomUUID(),
    crop: 'maize',
    adviceCategory: 'fall_armyworm',
    adviceSummary: 'Scout early morning; apply targeted control when 2 in 10 plants damaged.',
    outcome: 'improved',
};

describe('POST /efficacy/outcomes', () => {
    beforeEach(() => mockQuery.mockReset());

    it('requires authentication', async () => {
        const res = await request(app).post('/api/v1/efficacy/outcomes').send(validOutcome);
        expect(res.status).toBe(401);
    });

    it('rejects an invalid outcome verdict', async () => {
        const res = await request(app)
            .post('/api/v1/efficacy/outcomes')
            .set(officerHeader)
            .send({ ...validOutcome, outcome: 'miracle' });
        expect(res.status).toBe(400);
    });

    it('records an outcome with the officer from the auth context', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'oc-1', visit_id: validOutcome.visitId, farmer_id: validOutcome.farmerId, crop: 'maize', advice_category: 'fall_armyworm', outcome: 'improved', measured_at: new Date() }],
            rowCount: 1,
        });

        const res = await request(app)
            .post('/api/v1/efficacy/outcomes')
            .set(officerHeader)
            .send(validOutcome);

        expect(res.status).toBe(201);
        expect(res.body.data.outcome).toBe('improved');
        const insertCall = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO recommendation_outcomes'));
        expect(insertCall).toBeDefined();
        expect(insertCall[1][2]).toBe('off-1');
    });
});

describe('GET /efficacy/summary', () => {
    beforeEach(() => mockQuery.mockReset());

    it('computes success rates from aggregated rows', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { crop: 'maize', advice_category: 'fall_armyworm', total: '10', resolved: '6', improved: '2' },
                { crop: 'potato', advice_category: 'late_blight', total: '4', resolved: '1', improved: '0' },
            ],
            rowCount: 2,
        });

        const res = await request(app).get('/api/v1/efficacy/summary').set(officerHeader);
        expect(res.status).toBe(200);
        expect(res.body.data.totalOutcomes).toBe(14);
        expect(res.body.data.successCount).toBe(9);
        expect(res.body.data.overallSuccessRate).toBe(64);
        expect(res.body.data.byCategory[0].successRate).toBe(80);
    });

    it('scopes extension officers to their own outcomes', async () => {
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        await request(app).get('/api/v1/efficacy/summary').set(officerHeader);
        const call = mockQuery.mock.calls.find(c => String(c[0]).includes('FROM recommendation_outcomes'));
        expect(call).toBeDefined();
        expect(call[1]).toContain('off-1');
    });
});

describe('GET /efficacy/followups', () => {
    beforeEach(() => mockQuery.mockReset());

    it('returns the overdue follow-up queue', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'v-1', farmer_id: 'f-1', farmer_name: 'Alice Banda', visit_date: new Date(), notes: 'FAW advice given', days_overdue: '16' }],
            rowCount: 1,
        });

        const res = await request(app).get('/api/v1/efficacy/followups').set(officerHeader);
        expect(res.status).toBe(200);
        expect(res.body.data[0].farmerName).toBe('Alice Banda');
        expect(res.body.data[0].daysOverdue).toBe(16);
    });
});
