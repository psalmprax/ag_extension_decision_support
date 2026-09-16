import request from 'supertest';
import app from '../app';
import { makeOfficerToken } from './helpers/setupMocks';
import { outbreakService } from '../services/outbreakService';
import { plantDiseaseService } from '../services/plantDiseaseService';

// Mocks
jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn().mockResolvedValue({ rows: [{ id: 'rep-1' }], rowCount: 1 }),
}));

jest.mock('../services/cacheService', () => ({
    initializeDatabase: jest.fn(),
    getCache: jest.fn(() => null),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/outbreakService', () => ({
    outbreakService: {
        recordDiagnosisEvent: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../services/usageService', () => ({
    usageService: {
        checkLimit: jest.fn().mockResolvedValue({ allowed: true }),
        incrementUsageBy: jest.fn().mockResolvedValue(undefined),
    },
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('Diseases Route — Outbreak Intelligence Event Recording', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = makeOfficerToken({ userId: 'off-1', role: 'extension_officer' });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('POST /api/v1/diseases/diagnose triggers outbreakService.recordDiagnosisEvent for high confidence results', async () => {
        jest.spyOn(plantDiseaseService, 'diagnoseFromSymptoms').mockResolvedValueOnce([
            {
                disease: 'Maize Lethal Necrosis',
                confidence: 85,
                reviewStatus: 'ready',
                provenance: {
                    evidenceStatus: 'verified_source',
                    source: 'test',
                    sourceUrl: null,
                    sourceTimestamp: null,
                    provider: 'test',
                    model: 'test',
                    generatedAt: new Date().toISOString(),
                },
                safetyNotice: 'Notice',
                severity: 'severe',
                description: 'Severe necrosis',
                symptoms: ['wilting', 'yellowing'],
                treatment: ['Destroy crop'],
                prevention: ['Clean seed'],
            },
        ]);

        const response = await request(app)
            .post('/api/v1/ai/diseases/diagnose')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({
                symptoms: ['yellowing', 'wilting'],
                cropType: 'Maize',
                district: 'Lilongwe',
                farmerId: 'farm-123',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(outbreakService.recordDiagnosisEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                crop: 'Maize',
                diseaseLabel: 'Maize Lethal Necrosis',
                confidence: 85,
                district: 'Lilongwe',
                farmerId: 'farm-123',
                source: 'symptom_diagnosis',
            })
        );
    });

    it('POST /api/v1/diseases/diagnose/image triggers outbreakService.recordDiagnosisEvent for detected diseases', async () => {
        jest.spyOn(plantDiseaseService, 'analyzeImage').mockResolvedValueOnce({
            overallHealth: 'diseased',
            diseases: [
                {
                    disease: 'Banana Bacterial Wilt',
                    confidence: 90,
                    reviewStatus: 'ready',
                    provenance: {
                        evidenceStatus: 'verified_source',
                        source: 'test',
                        sourceUrl: null,
                        sourceTimestamp: null,
                        provider: 'test',
                        model: 'test',
                        generatedAt: new Date().toISOString(),
                    },
                    safetyNotice: 'Notice',
                    severity: 'severe',
                    description: 'Bacterial wilt',
                    symptoms: ['wilting'],
                    treatment: ['Eradication'],
                    prevention: ['Sterile tools'],
                },
            ],
            nutrientDeficiencies: [],
            recommendations: ['Report to agricultural officer'],
            confidence: 90,
            reviewStatus: 'ready',
            provenance: {
                evidenceStatus: 'verified_source',
                source: 'test',
                sourceUrl: null,
                sourceTimestamp: null,
                provider: 'test',
                model: 'test',
                generatedAt: new Date().toISOString(),
            },
        });

        // Small 1x1 png base64
        const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const response = await request(app)
            .post('/api/v1/ai/diseases/diagnose/image')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({
                imageData: dummyImage,
                cropType: 'Banana',
                district: 'Kasungu',
                farmerId: 'farm-456',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(outbreakService.recordDiagnosisEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                crop: 'Banana',
                diseaseLabel: 'Banana Bacterial Wilt',
                confidence: 90,
                district: 'Kasungu',
                farmerId: 'farm-456',
                source: 'ai_vision',
            })
        );
    });
});
