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
});