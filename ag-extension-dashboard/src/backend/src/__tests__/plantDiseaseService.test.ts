import { plantDiseaseService, DiseaseDiagnosis } from '../services/plantDiseaseService';

interface PrivatePlantDiseaseService {
  tokenize(text: string): string[];
  vectorize(tokens: string[], vocab: string[], idf: Record<string, number>): number[];
  cosineSimilarity(v1: number[], v2: number[]): number;
  diagnoseFromSymptoms(symptoms: string[]): Promise<DiseaseDiagnosis[]>;
  getDiseaseInfo(diseaseKey: string): { symptoms: string[] } | null;
  getAllDiseases(): string[];
}

const service = plantDiseaseService as unknown as PrivatePlantDiseaseService;

describe('PlantDiseaseService - tokenize', () => {
  it('should tokenize text and filter stopwords', () => {
    // Stopwords: ['on', 'of', 'and', 'the', 'with', 'a', 'or', 'in', 'to', 'for', 'at', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'an']
    // 'over' is NOT a stopword, 'the' IS a stopword
    const result = service.tokenize('The quick brown fox jumps over the lazy dog');
    expect(result).toContain('quick');
    expect(result).toContain('brown');
    expect(result).toContain('fox');
    expect(result).toContain('jumps'); // 5+ chars, not stopword
    expect(result).toContain('lazy'); // 4+ chars, not stopword
    expect(result).toContain('dog'); // 3 chars, not stopword (length > 2 filter)
    expect(result).not.toContain('the'); // stopword
  });

  it('should filter short words (length <= 2)', () => {
    const result = service.tokenize('a an is at');
    expect(result).toHaveLength(0);
  });
});

describe('PlantDiseaseService - vectorize', () => {
  it('should vectorize tokens against vocabulary', () => {
    const tokens = ['quick', 'brown', 'fox'];
    const vocab = ['quick', 'brown', 'fox', 'dog'];
    const idf = { quick: 1, brown: 1, fox: 1, dog: 1 };
    const result = service.vectorize(tokens, vocab, idf);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(1);
    expect(result[2]).toBe(1);
    expect(result[3]).toBe(0);
  });
});

describe('PlantDiseaseService - cosineSimilarity', () => {
  it('should calculate cosine similarity between identical vectors', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const result = service.cosineSimilarity(v1, v2);
    expect(result).toBe(1);
  });

  it('should calculate cosine similarity between orthogonal vectors', () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    const result = service.cosineSimilarity(v1, v2);
    expect(result).toBe(0);
  });

  it('should handle zero-magnitude vectors', () => {
    const v1 = [0, 0, 0];
    const v2 = [1, 1, 1];
    const result = service.cosineSimilarity(v1, v2);
    expect(result).toBe(0);
  });
});

describe('PlantDiseaseService - diagnoseFromSymptoms', () => {
  it('should diagnose late blight from matching symptoms', async () => {
    const symptoms = ['dark water-soaked lesions on leaves', 'white fungal growth on leaf undersides'];
    const diagnoses = await service.diagnoseFromSymptoms(symptoms);
    
    expect(diagnoses).toBeInstanceOf(Array);
    const lateBlight = diagnoses.find((d: DiseaseDiagnosis) => d.disease.includes('Late Blight'));
    expect(lateBlight).toBeDefined();
    expect(lateBlight?.disease).toBe('Late Blight');
    expect(lateBlight?.confidence).toBeGreaterThan(0);
  });

  it('should diagnose powdery mildew from matching symptoms', async () => {
    const symptoms = ['white powdery coating on leaves', 'yellowing leaves'];
    const diagnoses = await service.diagnoseFromSymptoms(symptoms);
    
    const powderyMildew = diagnoses.find((d: DiseaseDiagnosis) => d.disease.includes('Powdery Mildew'));
    expect(powderyMildew).toBeDefined();
    expect(powderyMildew?.disease).toBe('Powdery Mildew');
  });

  it('should return empty array for non-matching symptoms', async () => {
    const diagnoses = await service.diagnoseFromSymptoms(['unknown symptom xyz']);
    expect(diagnoses).toHaveLength(0);
  });

  it('should sort diagnoses by confidence descending', async () => {
    const symptoms = ['some agricultural symptom'];
    const diagnoses = await service.diagnoseFromSymptoms(symptoms);
    
    for (let i = 1; i < diagnoses.length; i++) {
      expect(diagnoses[i - 1].confidence).toBeGreaterThanOrEqual(diagnoses[i].confidence);
    }
  });

  it('should limit diagnoses to top 3', async () => {
    const symptoms = ['some agricultural symptom'];
    const diagnoses = await service.diagnoseFromSymptoms(symptoms);
    
    expect(diagnoses.length).toBeLessThanOrEqual(3);
  });
});

describe('PlantDiseaseService - getDiseaseInfo', () => {
  it('should return disease info for known disease', () => {
    const result = service.getDiseaseInfo('late_blight');
    expect(result).toBeDefined();
    expect(result?.symptoms).toContain('Dark water-soaked lesions on leaves');
  });

  it('should return null for unknown disease', () => {
    const result = service.getDiseaseInfo('unknown_disease');
    expect(result).toBeNull();
  });
});

describe('PlantDiseaseService - getAllDiseases', () => {
  it('should return all disease names', () => {
    const result = service.getAllDiseases();
    expect(result).toContain('Late Blight');
    expect(result).toContain('Powdery Mildew');
    expect(result).toContain('Bacterial Wilt');
    expect(result).toContain('Leaf Spot');
    expect(result).toContain('Rust');
    expect(result).toContain('Mosaic Virus');
    expect(result).toHaveLength(6);
  });
});