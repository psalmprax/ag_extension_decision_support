import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import diseaseRouter from '@/routes/diseases';
import { plantDiseaseService } from '@/services/plantDiseaseService';
import { query } from '@/services/databaseService';

// Mock dependencies
jest.mock('@/services/plantDiseaseService');
jest.mock('@/services/databaseService');
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = { userId: 'test-user-id', role: 'extension_officer' };
        next();
    },
    allowedRoles: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/auditMiddleware', () => ({
    logSensitiveAction: jest.fn(async () => undefined),
}));
jest.mock('@/services/outbreakService', () => ({
    outbreakService: {
        recordDiagnosisEvent: jest.fn(async () => undefined),
    },
}));
jest.mock('@/services/security/agronomicSafetyGuard', () => ({
    agronomicSafetyGuard: {
        validateStructuredMetrics: jest.fn(async () => ({ regulatoryDecision: { status: 'ALLOWED' } })),
    },
}));

const app = express();
app.use(express.json({ limit: '16mb' }));
app.use((req, res, next) => {
    console.log('[TEST] Request:', req.method, req.path, JSON.stringify(req.body).slice(0, 200));
    next();
});
app.use('/api/ai/diseases', diseaseRouter);
app.use((req, res) => {
    console.log('[TEST] 404:', req.method, req.path);
    res.status(404).json({ error: 'Not found' });
});

describe('Diseases Routes', () => {
    const mockDiagnoseFromSymptoms = plantDiseaseService.diagnoseFromSymptoms as jest.MockedFunction<
        typeof plantDiseaseService.diagnoseFromSymptoms
    >;
    const mockAnalyzeImage = plantDiseaseService.analyzeImage as jest.MockedFunction<
        typeof plantDiseaseService.analyzeImage
    >;
    const mockAnalyzeSoilImage = plantDiseaseService.analyzeSoilImage as jest.MockedFunction<
        typeof plantDiseaseService.analyzeSoilImage
    >;
    const mockQuery = query as jest.MockedFunction<typeof query>;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock implementations that return specific values
        mockAnalyzeSoilImage.mockReset();
        mockAnalyzeImage.mockReset();
        mockDiagnoseFromSymptoms.mockReset();
    });

    describe('POST /api/ai/diseases/diagnose', () => {
        it('returns 400 when symptoms are missing', async () => {
            const res = await request(app)
                .post('/api/ai/diseases/diagnose')
                .send({ cropType: 'maize' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('required');
        });

        it('calls plantDiseaseService.diagnoseFromSymptoms and returns result', async () => {
            const mockResult = [
                {
                    disease: 'Maize Rust',
                    confidence: 85,
                    reviewStatus: 'ready' as const,
                    provenance: { evidenceStatus: 'verified_source' as const, source: 'test', sourceUrl: null, sourceTimestamp: null, provider: 'test', model: 'test', generatedAt: new Date().toISOString() },
                    safetyNotice: 'Test notice',
                    severity: 'moderate' as const,
                    description: 'Test description',
                    symptoms: ['yellow leaves'],
                    treatment: ['Apply fungicide'],
                    prevention: ['Rotate crops'],
                },
            ];
            mockDiagnoseFromSymptoms.mockResolvedValue(mockResult);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let res: any;
            try {
                res = await request(app)
                    .post('/api/ai/diseases/diagnose')
                    .send({ symptoms: ['yellow leaves', 'brown spots'], cropType: 'maize' });
                console.log('[TEST] Diagnose Response:', res.status, res.body);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.log('[TEST] Diagnose Error:', err.status, err.message);
                if (err.response) {
                    console.log('[TEST] Diagnose Response body:', err.response.body);
                }
                throw err;
            }
            console.log('[TEST] Final Response:', res.status, JSON.stringify(res.body).slice(0, 500));
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(expect.arrayContaining([
                expect.objectContaining({ disease: 'Maize Rust' }),
            ]));
        });

        it('returns 500 when service throws', async () => {
            mockDiagnoseFromSymptoms.mockRejectedValue(new Error('Service failed'));

            const res = await request(app)
                .post('/api/ai/diseases/diagnose')
                .send({ symptoms: ['symptom1'], cropType: 'maize' })
                .expect(500);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Failed to diagnose disease');
        });
    });

    describe('POST /api/ai/diseases/diagnose/image', () => {
        it('returns 400 when imageData is missing', async () => {
            const res = await request(app)
                .post('/api/ai/diseases/diagnose/image')
                .send({ cropType: 'maize' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Image data is required');
        });

        it('calls plantDiseaseService.analyzeImage and returns result', async () => {
            const mockResult = {
                overallHealth: 'diseased' as const,
                diseases: [{
                    disease: 'Coffee Leaf Rust',
                    confidence: 90,
                    reviewStatus: 'ready' as const,
                    provenance: { evidenceStatus: 'verified_source' as const, source: 'test', sourceUrl: null, sourceTimestamp: null, provider: 'test', model: 'test', generatedAt: new Date().toISOString() },
                    safetyNotice: 'Test notice',
                    severity: 'severe' as const,
                    description: 'Test description',
                    symptoms: ['orange spots'],
                    treatment: ['Apply fungicide'],
                    prevention: ['Prune affected leaves'],
                }],
                nutrientDeficiencies: [],
                recommendations: ['Apply fungicide'],
                confidence: 90,
                reviewStatus: 'ready' as const,
                provenance: { evidenceStatus: 'verified_source' as const, source: 'test', sourceUrl: null, sourceTimestamp: null, provider: 'test', model: 'test', generatedAt: new Date().toISOString() },
            };
            mockAnalyzeImage.mockResolvedValue(mockResult);
            mockQuery.mockResolvedValue({ rows: [{ id: 'report-456' }], rowCount: 1 });

            const res = await request(app)
                .post('/api/ai/diseases/diagnose/image')
                .send({ imageData: 'base64imagedata', cropType: 'coffee' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(expect.objectContaining({
                overallHealth: 'diseased',
                reportId: 'report-456',
            }));
        });
    });

    describe('POST /api/ai/diseases/diagnose/soil', () => {
        it('returns 400 when imageData is missing', async () => {
            const res = await request(app)
                .post('/api/ai/diseases/diagnose/soil')
                .send({ cropType: 'maize' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Soil image data is required');
        });

        it('returns 400 when image payload decodes to empty', async () => {
            // Send a data URL with no actual base64 data to trigger the "decodedBytes === 0" check
            const analyzeSoilSpy = jest.spyOn(plantDiseaseService, 'analyzeSoilImage');
            try {
                const res = await request(app)
                    .post('/api/ai/diseases/diagnose/soil')
                    .send({ imageData: 'data:image/jpeg;base64,', cropType: 'maize' })
                    .expect(400);

                console.log('[TEST] Response:', res.status, res.body);
                expect(res.body.success).toBe(false);
                expect(res.body.error).toBe('Invalid or empty soil image payload');
                expect(analyzeSoilSpy).not.toHaveBeenCalled();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.log('[TEST] Error:', err.status, err.message);
                if (err.response) {
                    console.log('[TEST] Response body:', err.response.body);
                }
                throw err;
            } finally {
                analyzeSoilSpy.mockRestore();
            }
        });

        it('calls plantDiseaseService.analyzeSoilImage and returns result', async () => {
            const mockResult = {
                overallHealthScore: 75,
                texture: 'Loamy',
                estimatedMoisture: 'Optimal',
                drainageClass: 'Well drained',
                colorDiscoloration: 'Normal',
                npkDeficiencies: { nitrogen: 'low' as const, phosphorus: 'optimal' as const, potassium: 'high' as const },
                recommendations: ['Add nitrogen fertilizer'],
                cropSuitability: ['Maize', 'Beans'],
                confidence: 80,
                reviewStatus: 'ready' as const,
                provenance: { evidenceStatus: 'verified_source' as const, source: 'test', sourceUrl: null, sourceTimestamp: null, provider: 'test', model: 'test', generatedAt: new Date().toISOString() },
            };
            mockAnalyzeSoilImage.mockResolvedValue(mockResult);
            mockQuery.mockResolvedValue({ rows: [{ id: 'report-789' }], rowCount: 1 });

            const imageData = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
            const res = await request(app)
                .post('/api/ai/diseases/diagnose/soil')
                .send({ imageData, cropType: 'maize', details: {} })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(expect.objectContaining({
                overallHealthScore: 75,
                texture: 'Loamy',
            }));
        });
    });
});