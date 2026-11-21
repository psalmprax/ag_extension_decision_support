jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/uploadService', () => ({ readStoredUpload: jest.fn().mockResolvedValue(Buffer.from('jpeg')) }));
jest.mock('@/services/plantDiseaseService', () => ({ plantDiseaseService: { analyzeImage: jest.fn() } }));
jest.mock('@/services/access/farmerScope', () => ({ canSeeFarmer: jest.fn() }));

import { query } from '@/services/databaseService';
import { plantDiseaseService } from '@/services/plantDiseaseService';
import { canSeeFarmer } from '@/services/access/farmerScope';
import { matchesLabel, normaliseLabel, topPrediction } from '@/services/diagnosisTests/matching';
import { validationFor, withValidation, MIN_SAMPLES } from '@/services/diagnosisTests/gate';
import { runEvaluation } from '@/services/diagnosisTests/evaluate';
import { addTestImage, TestSetError } from '@/services/diagnosisTests/testSet';

const mockQuery = query as jest.Mock;
beforeEach(() => { mockQuery.mockReset(); jest.clearAllMocks(); });

describe('matching a diagnosis to the label', () => {
    it('accepts a longer name for the same problem', () => {
        expect(matchesLabel('Maize Lethal Necrosis Disease (MLND)', 'maize lethal necrosis')).toBe(true);
        expect(matchesLabel('Northern Leaf Blight', 'northern leaf blight')).toBe(true);
    });

    it('does not accept a different or vaguer problem', () => {
        expect(matchesLabel('Leaf blight', 'northern leaf blight')).toBe(false);
        expect(matchesLabel('Gray leaf spot', 'northern leaf blight')).toBe(false);
    });

    it('reads a photo with no disease as healthy', () => {
        expect(topPrediction({ overallHealth: 'healthy', diseases: [] }).name).toBe('healthy');
        expect(normaliseLabel('  Leaf  Rust ')).toBe('leaf rust');
    });
});

describe('what a farmer is told', () => {
    const passing = { label: 'northern leaf blight', samples: MIN_SAMPLES, correct: MIN_SAMPLES };

    it('marks a diagnosis tested only with enough photos, enough of them right', () => {
        expect(validationFor('Northern Leaf Blight', [passing]).status).toBe('tested');
        expect(validationFor('Northern Leaf Blight', [{ ...passing, correct: Math.floor(MIN_SAMPLES / 2) }]).status).toBe('below_threshold');
        expect(validationFor('Northern Leaf Blight', [{ ...passing, samples: 3, correct: 3 }]).status).toBe('below_threshold');
        expect(validationFor('Common rust', [passing]).status).toBe('not_tested');
    });

    it('sends an untested diagnosis to the officer, however sure the AI is', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const analysis = {
            overallHealth: 'diseased', confidence: 95, reviewStatus: 'ready', nutrientDeficiencies: [], recommendations: [],
            provenance: {} as never,
            diseases: [{ disease: 'Common rust', confidence: 95, reviewStatus: 'ready' } as never],
        };
        const result = await withValidation(analysis as unknown as Parameters<typeof withValidation>[0], 'Maize');
        expect(result.reviewStatus).toBe('needs_expert_review');
        expect(result.validation).toEqual({ status: 'not_tested', samples: 0, accuracy: null });
        expect(mockQuery.mock.calls[0][1]).toEqual(['maize']);
    });
});

describe('a test run', () => {
    it('counts right and wrong answers and records the result per class', async () => {
        (plantDiseaseService.analyzeImage as jest.Mock)
            .mockResolvedValueOnce({ overallHealth: 'diseased', diseases: [{ disease: 'Northern Leaf Blight', confidence: 80 }] })
            .mockResolvedValueOnce({ overallHealth: 'diseased', diseases: [{ disease: 'Gray leaf spot', confidence: 70 }] });
        mockQuery.mockResolvedValue({ rows: [] });
        await runEvaluation('run-1', [
            { id: 'p1', crop: 'maize', label: 'northern leaf blight', storage_key: 'a.jpg' },
            { id: 'p2', crop: 'maize', label: 'northern leaf blight', storage_key: 'b.jpg' },
        ]);
        const results = mockQuery.mock.calls.filter(call => String(call[0]).includes('INSERT INTO diagnosis_eval_results'));
        expect(results.map(call => call[1][4])).toEqual([true, false]);
        const sql = mockQuery.mock.calls.map(call => String(call[0]));
        expect(sql.some(s => s.includes('INSERT INTO diagnosis_class_status'))).toBe(true);
        expect(sql.some(s => s.includes("status = 'finished'"))).toBe(true);
    });
});

describe('labelling photos', () => {
    const officer = { userId: 'officer-1', role: 'extension_officer' };

    it('lets an officer label a photo of a farmer they serve, as a field confirmation', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ owner_user_id: 'farmer-user', farmer_id: 'f1', mime_type: 'image/jpeg' }] })
            .mockResolvedValueOnce({ rows: [{ id: 't1' }] });
        (canSeeFarmer as jest.Mock).mockResolvedValueOnce(true);
        await expect(addTestImage(officer, { uploadId: 'u1', crop: 'Maize', label: 'Northern leaf blight' })).resolves.toEqual({ id: 't1' });
        expect(mockQuery.mock.calls[1][1]).toEqual(['u1', 'maize', 'northern leaf blight', 'officer_confirmation', null, 'officer-1']);
    });

    it('refuses a photo of another officer’s farmer, without saying it exists', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ owner_user_id: 'someone', farmer_id: 'f2', mime_type: 'image/jpeg' }] });
        (canSeeFarmer as jest.Mock).mockResolvedValueOnce(false);
        await expect(addTestImage(officer, { uploadId: 'u2', crop: 'maize', label: 'rust' })).rejects.toThrow(new TestSetError('Photo not found', 404));
    });
});
