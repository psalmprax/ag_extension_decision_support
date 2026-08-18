import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

describe('Deep-Tier Security — AgronomicSafetyGuard AI Boundary Validation', () => {
  describe('1. Structured Metric Boundary Enforcement', () => {
    it('should flag and block excessive Nitrogen fertilizer recommendations', () => {
      const result = agronomicSafetyGuard.validateStructuredMetrics({
        cropType: 'Maize',
        nitrogenKgHa: 450, // Exceeds 300 kg/ha limit
      });

      expect(result.safe).toBe(false);
      expect(result.hazardLevel).toBe('critical_hazard');
      expect(result.violations.some((v) => v.includes('Excessive Nitrogen'))).toBe(true);
    });

    it('should flag and block lethal pesticide application rates', () => {
      const result = agronomicSafetyGuard.validateStructuredMetrics({
        cropType: 'Cotton',
        pesticideMlHa: 12000, // 12 Liters / ha — lethal overdose
        pesticideName: 'Chlorpyrifos',
      });

      expect(result.safe).toBe(false);
      expect(result.hazardLevel).toBe('critical_hazard');
      expect(result.violations.some((v) => v.includes('Lethal pesticide dosage'))).toBe(true);
    });

    it('should detect high-consequence quarantine diseases and trigger containment alert', () => {
      const result = agronomicSafetyGuard.validateStructuredMetrics({
        cropType: 'Maize',
        identifiedPestsOrDiseases: ['Maize Lethal Necrosis Disease outbreak in Sector 4'],
      });

      expect(result.safe).toBe(false);
      expect(result.quarantineAlert).toBe(true);
      expect(result.quarantineDiseases).toContain('maize lethal necrosis');
    });

    it('should approve valid, agronomic recommendations within safe FAO bounds', () => {
      const result = agronomicSafetyGuard.validateStructuredMetrics({
        cropType: 'Maize',
        nitrogenKgHa: 100,
        phosphorusKgHa: 50,
        potassiumKgHa: 40,
        pesticideMlHa: 800,
        soilPh: 6.5,
        identifiedPestsOrDiseases: ['Common rust'],
      });

      expect(result.safe).toBe(true);
      expect(result.hazardLevel).toBe('safe');
      expect(result.violations.length).toBe(0);
      expect(result.quarantineAlert).toBe(false);
    });
  });

  describe('2. Unstructured LLM Text Output Scanning', () => {
    it('should detect hallucinated extreme liquid chemical recommendations in AI text', () => {
      const hallucinatedAiText =
        'To eliminate armyworms immediately, apply 25 Liters per hectare of concentrated formulation.';
      const result = agronomicSafetyGuard.scanGeneratedAdvice(hallucinatedAiText);

      expect(result.safe).toBe(false);
      expect(result.hazardLevel).toBe('critical_hazard');
      expect(result.violations.some((v) => v.includes('lethal liquid dosage'))).toBe(true);
    });

    it('should pass normal, realistic agronomic advisory text', () => {
      const safeAiText =
        'Apply 1.5 L/ha of approved bio-pesticide early in the morning, followed by light irrigation.';
      const result = agronomicSafetyGuard.scanGeneratedAdvice(safeAiText);

      expect(result.safe).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });
});
