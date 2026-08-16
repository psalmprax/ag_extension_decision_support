import { plantDiseaseService } from '../services/plantDiseaseService';
import { AIProviderFactory } from '../services/aiProvider/aiProvider';

jest.mock('../services/aiProvider/aiProvider', () => ({
    AIProviderFactory: {
        getProvider: jest.fn(),
    },
}));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockGetProvider = AIProviderFactory.getProvider as jest.MockedFunction<typeof AIProviderFactory.getProvider>;

function makeVisionProvider(analysis: string) {
    return {
        provider: 'openai' as const,
        analyzeImage: jest.fn().mockResolvedValue({
            analysis,
            model: 'vision-test-model',
        }),
    } as unknown as Awaited<ReturnType<typeof AIProviderFactory.getProvider>>;
}

describe('plantDiseaseService diagnostic trust contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns symptom confidence on a 0-1 scale with source provenance', async () => {
        const [diagnosis] = await plantDiseaseService.diagnoseFromSymptoms([
            'White powdery coating on leaves',
        ]);

        expect(diagnosis).toBeDefined();
        expect(diagnosis.confidence).toBeGreaterThanOrEqual(0);
        expect(diagnosis.confidence).toBeLessThanOrEqual(1);
        expect(diagnosis.provenance).toEqual(expect.objectContaining({
            evidenceStatus: 'verified_source',
            source: 'Internal Plant Disease Knowledge Base',
            model: 'tfidf-symptom-matcher',
        }));
        expect(['ready', 'needs_expert_review']).toContain(diagnosis.reviewStatus);
    });

    it('normalizes vision confidence and marks unverified model output for review', async () => {
        mockGetProvider.mockResolvedValueOnce(makeVisionProvider(JSON.stringify({
            overallHealth: 'diseased',
            diseases: [{
                disease: 'Powdery Mildew',
                confidence: 40,
                severity: 'moderate',
                description: 'Possible fungal disease',
                symptoms: ['White coating'],
                treatment: ['Seek local guidance'],
                prevention: ['Improve airflow'],
            }],
            nutrientDeficiencies: [],
            recommendations: ['Confirm with an agronomist'],
            confidence: 72,
        })));

        const result = await plantDiseaseService.analyzeImage('base64-image');

        expect(result.confidence).toBe(0.72);
        expect(result.diseases[0].confidence).toBe(0.4);
        expect(result.reviewStatus).toBe('needs_expert_review');
        expect(result.diseases[0].reviewStatus).toBe('needs_expert_review');
        expect(result.provenance).toEqual(expect.objectContaining({
            evidenceStatus: 'no_verified_source',
            provider: 'openai',
            model: 'vision-test-model',
        }));
    });

    it('does not return invented health metrics when vision analysis is unavailable', async () => {
        mockGetProvider.mockRejectedValueOnce(new Error('provider unavailable'));

        const result = await plantDiseaseService.analyzeImage('base64-image');

        expect(result.overallHealth).toBe('unknown');
        expect(result.confidence).toBe(0);
        expect(result.reviewStatus).toBe('needs_expert_review');
        expect(result.diseases).toEqual([]);
        expect(result.provenance.evidenceStatus).toBe('no_verified_source');
    });

    it('does not return invented soil metrics when soil analysis cannot be parsed', async () => {
        mockGetProvider.mockResolvedValueOnce(makeVisionProvider('not-json'));

        const result = await plantDiseaseService.analyzeSoilImage('base64-image');

        expect(result.overallHealthScore).toBeNull();
        expect(result.confidence).toBe(0);
        expect(result.npkDeficiencies).toEqual({
            nitrogen: 'unknown',
            phosphorus: 'unknown',
            potassium: 'unknown',
        });
        expect(result.cropSuitability).toEqual([]);
        expect(result.reviewStatus).toBe('needs_expert_review');
    });
});
