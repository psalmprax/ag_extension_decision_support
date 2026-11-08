import { describe, expect, it } from 'vitest';
import { withholdEdgeAdvice } from '../services/edgePlantVisionClassifier';

describe('offline diagnosis safety', () => {
  it('withholds unverified cultural, biological and chemical instructions', () => {
    const result = withholdEdgeAdvice({
      condition: 'Possible rust', scientificName: 'unknown', crop: 'maize', confidence: 0.9,
      severity: 'mild', symptoms: ['spots'], culturalControl: ['apply lime'],
      biologicalControl: ['spray neem'], chemicalIntervention: 'apply fungicide',
    });
    expect(result.condition).toBe('Possible rust');
    expect(result.culturalControl.join(' ')).toContain('withheld');
    expect(result.biologicalControl).toEqual([]);
    expect(result.chemicalIntervention).toContain('withheld');
  });
});
