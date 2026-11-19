import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import diseaseRouter from '@/routes/diseases';
import { query } from '@/services/databaseService';

jest.mock('@/services/plantDiseaseService', () => ({
    plantDiseaseService: {
        getAllDiseases: jest.fn(() => []),
        getDiseaseInfo: jest.fn(() => null),
        diagnoseFromSymptoms: jest.fn(async () => []),
        analyzeImage: jest.fn(),
        analyzeSoilImage: jest.fn(),
    },
}));
jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (_req: Request, _res: Response, next: NextFunction) => next(),
    optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/auditMiddleware', () => ({ logSensitiveAction: jest.fn(async () => undefined) }));
jest.mock('@/services/outbreakService', () => ({
    outbreakService: { recordDiagnosisEvent: jest.fn(async () => undefined) },
}));
jest.mock('@/services/security/agronomicSafetyGuard', () => ({
    agronomicSafetyGuard: { validateStructuredMetrics: jest.fn(() => ({ regulatoryDecision: { status: 'ALLOWED' } })) },
}));

// The real authorize middleware is replaced above, so the identity is injected
// here; headers let a single app serve both the officer and admin cases.
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
    (req as unknown as { user: { userId: string; role: string } }).user = {
        userId: req.get('x-test-user') ?? 'officer-1',
        role: req.get('x-test-role') ?? 'extension_officer',
    };
    next();
});
app.use('/api/ai/diseases', diseaseRouter);

const mockQuery = query as jest.MockedFunction<typeof query>;

const rows = [
    {
        id: 'diag-1',
        farmer_id: 'farmer-1',
        district: 'Nakuru',
        crop: 'maize',
        disease_label: 'Maize rust',
        confidence: '0.82',
        source: 'ai_vision',
        created_at: '2026-11-01T10:00:00.000Z',
    },
];

function asOfficer(userId = 'officer-1') {
    return request(app).get('/api/ai/diseases/history').set('x-test-user', userId);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows, rowCount: rows.length } as never);
});

describe('GET /api/ai/diseases/history', () => {
    it('reads the caller own diagnoses and maps them to the API shape', async () => {
        const res = await asOfficer().expect(200);

        expect(res.body.data.items).toEqual([
            {
                id: 'diag-1',
                farmerId: 'farmer-1',
                district: 'Nakuru',
                crop: 'maize',
                diseaseLabel: 'Maize rust',
                confidence: 0.82,
                source: 'ai_vision',
                createdAt: '2026-11-01T10:00:00.000Z',
            },
        ]);
        expect(res.body.data).toMatchObject({ limit: 25, offset: 0 });
        expect(String(mockQuery.mock.calls[0][0])).toContain('WHERE user_id = $1');
        expect(mockQuery.mock.calls[0][1]).toEqual(['officer-1', 25, 0]);
    });

    it('refuses another account history for a non-admin caller', async () => {
        const res = await asOfficer().query({ userId: 'someone-else' }).expect(403);

        expect(res.body.success).toBe(false);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('lets an administrator audit another account', async () => {
        const res = await request(app)
            .get('/api/ai/diseases/history')
            .query({ userId: 'farmer-1' })
            .set('x-test-user', 'admin-1')
            .set('x-test-role', 'admin')
            .expect(200);

        expect(res.body.data.items).toHaveLength(1);
        expect(mockQuery.mock.calls[0][1]).toEqual(['farmer-1', 25, 0]);
    });

    it('clamps the page size and rejects negative offsets', async () => {
        await asOfficer().query({ limit: '500', offset: '-10' }).expect(200);

        expect(mockQuery.mock.calls[0][1]).toEqual(['officer-1', 100, 0]);
    });
});
