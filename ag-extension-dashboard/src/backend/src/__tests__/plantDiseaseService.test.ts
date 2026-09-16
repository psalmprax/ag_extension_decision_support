import { plantDiseaseService } from '../services/plantDiseaseService';

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
});