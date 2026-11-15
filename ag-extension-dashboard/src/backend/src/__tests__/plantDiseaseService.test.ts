import { plantDiseaseService } from '../services/plantDiseaseService';
import { AIRouter } from '../services/aiProvider/aiProvider';

jest.mock('../services/aiProvider/aiProvider', () => ({
  AIRouter: { routeRequest: jest.fn() },
}));

describe('PlantDiseaseService — Crop Isolation & Symptom Diagnostics', () => {
  it('should diagnose Late Blight when symptoms match and crop is potato', async () => {
    const symptoms = ['Dark water-soaked lesions on leaves', 'White fungal growth on leaf undersides'];
    const results = await plantDiseaseService.diagnoseFromSymptoms(symptoms, 'potato');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].disease).toBe('Late Blight');
  });

  it('should exclude Late Blight when crop is coffee even if symptoms match water-soaked lesions', async () => {
    const symptoms = ['Dark water-soaked lesions on leaves', 'White fungal growth on leaf undersides'];
    const results = await plantDiseaseService.diagnoseFromSymptoms(symptoms, 'coffee');

    // Late Blight must not be diagnosed for coffee
    expect(results.some((d) => d.disease === 'Late Blight')).toBe(false);
  });

  it('should diagnose Rust or Mosaic Virus when crop is maize', async () => {
    const symptoms = ['Orange-brown pustules on leaf undersides', 'Yellow spots on upper leaf surface'];
    const results = await plantDiseaseService.diagnoseFromSymptoms(symptoms, 'maize');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].disease).toBe('Rust');
    // Solanaceous diseases must not appear
    expect(results.some((d) => d.disease === 'Late Blight')).toBe(false);
    expect(results.some((d) => d.disease === 'Early Blight')).toBe(false);
  });

  it('should allow general diseases when crop is unspecified or compatible', async () => {
    const symptoms = ['White powdery coating on leaves', 'Yellowing leaves'];
    const results = await plantDiseaseService.diagnoseFromSymptoms(symptoms);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].disease).toBe('Powdery Mildew');
  });

  it('should support expanded 30-disease FAO and national extension catalog', () => {
    const all = plantDiseaseService.getAllDiseases();
    expect(all.length).toBe(30);
    expect(all).toContain('Maize Lethal Necrosis');
    expect(all).toContain('Fall Armyworm');
    expect(all).toContain('Coffee Leaf Rust');
    expect(all).toContain('Rice Blast');
    expect(all).toContain('Banana Xanthomonas Wilt');
  });

  it('should retrieve detailed dossier via getDiseaseDetails alias', () => {
    const mlnd = plantDiseaseService.getDiseaseDetails('maize_lethal_necrosis');
    expect(mlnd).toBeDefined();
    expect(mlnd?.disease).toBe('Maize Lethal Necrosis');
    expect(mlnd?.susceptibleCrops).toContain('maize');
    expect(mlnd?.description).toContain('biosecurity quarantine');

    const rust = plantDiseaseService.getDiseaseInfo('Coffee Leaf Rust');
    expect(rust).toBeDefined();
    expect(rust?.disease).toBe('Coffee Leaf Rust');
    expect(rust?.susceptibleCrops).toContain('coffee');
  });

  it('should diagnose Coffee Leaf Rust on coffee when orange pustules match', async () => {
    const symptoms = ['Powdery orange-yellow spore pustules on leaf undersides', 'Premature heavy defoliation'];
    const results = await plantDiseaseService.diagnosePlant(symptoms, 'coffee');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(d => d.disease === 'Coffee Leaf Rust')).toBe(true);
  });

  it('withholds unverified treatments but provides low-risk prevention in symptom and library responses', async () => {
    const symptoms = ['White powdery coating on leaves', 'Yellowing leaves'];
    const results = await plantDiseaseService.diagnoseFromSymptoms(symptoms);
    const powdery = results.find(result => result.disease === 'Powdery Mildew');
    expect(powdery?.provenance.evidenceStatus).toBe('no_verified_source');
    expect(powdery?.reviewStatus).toBe('needs_expert_review');
    expect(powdery?.treatment.join(' ')).toContain('withheld');
    expect(powdery?.prevention.join(' ')).toContain('Monitor affected and nearby plants');
    expect(powdery?.prevention.join(' ')).not.toContain('spray');
    const info = plantDiseaseService.getDiseaseInfo('Powdery Mildew');
    expect(info?.treatment.join(' ')).not.toContain('2ml/L');
    expect(info?.prevention.join(' ')).toContain('Monitor affected and nearby plants');
  });

  it('does not present model treatment or high model confidence as verified', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockResolvedValueOnce({
      analysis: JSON.stringify({
        overallHealth: 'diseased',
        diseases: [{ disease: 'Rust', confidence: 99, severity: 'severe', description: 'Spots',
          symptoms: ['spots'], treatment: ['Apply fungicide'], prevention: ['Spray'], safetyNotice: 'Safe' }],
        nutrientDeficiencies: [], recommendations: ['Use 2 ml/L neem'], confidence: 99,
      }),
    });
    try {
      const result = await plantDiseaseService.analyzeImage('image');
      expect(result.reviewStatus).toBe('needs_expert_review');
      expect(result.provenance.evidenceStatus).toBe('no_verified_source');
      expect(result.diseases[0].reviewStatus).toBe('needs_expert_review');
      expect(result.diseases[0].treatment.join(' ')).toContain('withheld');
      expect(result.recommendations.join(' ')).not.toContain('2 ml/L');
      expect(result.recommendations.join(' ')).toContain('Record the crop, growth stage');
      expect(result.diseases[0].prevention.join(' ')).not.toContain('Spray');
      expect(result.diseases[0].safetyNotice).toContain('qualified agronomist');
    } finally {
      spy.mockRestore();
    }
  });

  it('returns useful next steps for stress without a disease match or fabricated model provenance', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockResolvedValueOnce({
      provider: 'aihubmix',
      analysis: JSON.stringify({
        overallHealth: 'stressed', diseases: [], nutrientDeficiencies: ['Possible nitrogen deficiency'],
        recommendations: ['Apply 100 kg/ha of urea.'], confidence: 85,
      }),
    });
    try {
      const result = await plantDiseaseService.analyzeImage('image', 'maize');
      expect(result.overallHealth).toBe('stressed');
      expect(result.confidence).toBe(0.85);
      expect(result.reviewStatus).toBe('needs_expert_review');
      expect(result.nutrientDeficiencies).toEqual(['Possible nitrogen deficiency']);
      expect(result.recommendations.join(' ')).toContain('Check soil moisture and drainage');
      expect(result.recommendations.join(' ')).toContain('soil or leaf-tissue test');
      expect(result.recommendations.join(' ')).not.toContain('100 kg/ha');
      expect(result.recommendations.join(' ')).not.toContain('prevention advice is withheld');
      expect(result.provenance.model).toBeNull();
      expect(AIRouter.routeRequest).toHaveBeenLastCalledWith('vision', expect.objectContaining({
        prompt: expect.stringContaining('A photograph alone cannot confirm'),
      }));
    } finally {
      spy.mockRestore();
    }
  });

  it('withholds prescriptions embedded in free-text image observations', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockResolvedValueOnce({
      analysis: JSON.stringify({
        overallHealth: 'stressed',
        diseases: [{
          disease: 'Rust', confidence: 80, severity: 'moderate',
          description: 'Possible rust; apply 100 kg/ha of urea.',
          symptoms: ['Orange spots on leaves', 'Spray 3 ml/L of pesticide.'],
        }],
        nutrientDeficiencies: ['Possible nitrogen deficiency; apply 100 kg/ha of urea.'],
        confidence: 85,
      }),
    });
    try {
      const result = await plantDiseaseService.analyzeImage('image');
      expect(result.nutrientDeficiencies).toHaveLength(1);
      expect(result.nutrientDeficiencies[0]).toContain('withheld');
      expect(result.nutrientDeficiencies.join(' ')).not.toContain('100 kg/ha');
      expect(result.diseases[0].description).toContain('withheld');
      expect(result.diseases[0].description).not.toContain('100 kg/ha');
      expect(result.diseases[0].symptoms).toContain('Orange spots on leaves');
      expect(result.diseases[0].symptoms.join(' ')).not.toContain('3 ml/L');
      expect(result.diseases[0].symptoms.join(' ')).toContain('withheld');
    } finally {
      spy.mockRestore();
    }
  });

  it('drops malformed nutrient and symptom collections from image observations', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockResolvedValueOnce({
      analysis: JSON.stringify({
        overallHealth: 'healthy',
        diseases: [{
          disease: 'Rust', confidence: 80, severity: 'moderate',
          description: 'Orange pustules may be consistent with rust.',
          symptoms: null,
        }],
        nutrientDeficiencies: 'Possible nitrogen deficiency',
        confidence: 85,
      }),
    });
    try {
      const result = await plantDiseaseService.analyzeImage('image');
      expect(result.nutrientDeficiencies).toEqual([]);
      expect(result.diseases[0].symptoms).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('preserves actual model provenance and defaults missing deficiency observations to empty', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockResolvedValueOnce({
      provider: 'aihubmix', model: 'gemini-3.1-flash-lite',
      analysis: JSON.stringify({
        overallHealth: 'healthy', diseases: [], recommendations: [], confidence: 90,
      }),
    });
    try {
      const result = await plantDiseaseService.analyzeImage('image');
      expect(result.nutrientDeficiencies).toEqual([]);
      expect(result.provenance.model).toBe('gemini-3.1-flash-lite');
      expect(result.recommendations.join(' ')).toContain('Record the crop, growth stage');
      expect(result.recommendations.join(' ')).not.toContain('soil or leaf-tissue test');
    } finally {
      spy.mockRestore();
    }
  });

  it('replaces soil prescriptions with low-risk observation and testing guidance', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockResolvedValueOnce({
      analysis: JSON.stringify({
        overallHealthScore: 60, texture: 'Possible loam', confidence: 85,
        recommendations: ['Apply 100 kg/ha of fertilizer.'],
      }),
    });
    try {
      const result = await plantDiseaseService.analyzeSoilImage('image');
      expect(result.recommendations.join(' ')).toContain('laboratory soil test');
      expect(result.recommendations.join(' ')).not.toContain('100 kg/ha');
      expect(result.provenance.model).toBeNull();
      expect(result.reviewStatus).toBe('needs_expert_review');
    } finally {
      spy.mockRestore();
    }
  });

  it('does not expose provider errors in unavailable plant or soil analyses', async () => {
    const spy = jest.spyOn(AIRouter, 'routeRequest').mockRejectedValue(new Error('private upstream detail'));
    try {
      const plantResult = await plantDiseaseService.analyzeImage('image');
      expect(plantResult.overallHealth).toBe('unknown');
      expect(plantResult.provenance.source).toBe('AI vision analysis unavailable; no verified source');
      expect(JSON.stringify(plantResult)).not.toContain('private upstream detail');

      const soilResult = await plantDiseaseService.analyzeSoilImage('image');
      expect(soilResult.colorDiscoloration).toBe('Analysis unavailable');
      expect(soilResult.provenance.source).toBe('AI soil image analysis unavailable; no verified source');
      expect(JSON.stringify(soilResult)).not.toContain('private upstream detail');
    } finally {
      spy.mockRestore();
    }
  });
});