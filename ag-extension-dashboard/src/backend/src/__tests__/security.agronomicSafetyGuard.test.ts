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

  describe('3. Knapsack Sprayer Calibration & Advice Enrichment', () => {
    it('should append knapsack sprayer calibration when application rates are mentioned', () => {
      const advice = 'Apply 2.5 L/ha of contact fungicide across the affected area.';
      const enriched = agronomicSafetyGuard.translateToKnapsackUnits(advice);

      expect(enriched).toContain('Knapsack Sprayer Calibration (Field Guidance)');
      expect(enriched).toContain('16L or 20L');
    });

    it('should prepend lethal dosage alert and knapsack calibration during guardAndEnrichAdvice', () => {
      const hazardousAdvice = 'Apply 30 Liters per hectare of pesticide solution to control the pest.';
      const { text, boundaryCheck } = agronomicSafetyGuard.guardAndEnrichAdvice(hazardousAdvice);

      expect(boundaryCheck.safe).toBe(false);
      expect(text).toContain('AGRONOMIC DOSAGE WARNING');
      expect(text).toContain('Knapsack Sprayer Calibration');
    });

    it('should prepend quarantine alert when high-consequence pathogen is detected in advice', () => {
      const quarantineAdvice = 'Symptoms match maize lethal necrosis disease in the lower parcel.';
      const { text, boundaryCheck } = agronomicSafetyGuard.guardAndEnrichAdvice(quarantineAdvice);

      expect(boundaryCheck.quarantineAlert).toBe(true);
      expect(text).toContain('QUARANTINE ALERT');
      expect(text).toContain('maize lethal necrosis');
    });

    it('should append Pre-Harvest Interval (PHI) and Pollinator safety warnings for chemical recommendations', () => {
      const chemicalAdvice = 'Spray 1.5 L/ha of pesticide during flowering stage to control aphids.';
      const { text } = agronomicSafetyGuard.guardAndEnrichAdvice(chemicalAdvice);

      expect(text).toContain('Pre-Harvest & Re-Entry Safety (PHI / REI)');
      expect(text).toContain('Pollinator & Bee Protection Warning');
    });
  });

  describe('4. Pre-Harvest Interval & Pollinator Boundary Checks', () => {
    it('should flag violation when pesticide is applied too close to harvest', () => {
      const result = agronomicSafetyGuard.validateStructuredMetrics({
        cropType: 'Tomato',
        pesticideMlHa: 1000,
        daysToHarvest: 3, // Less than 7 days safe PHI
      });

      expect(result.safe).toBe(false);
      expect(result.hazardLevel).toBe('critical_hazard');
      expect(result.violations.some((v) => v.includes('Pre-Harvest Interval (PHI) violation'))).toBe(true);
    });

    it('should flag violation when insecticide is applied during active flowering or pollinator foraging', () => {
      const result = agronomicSafetyGuard.validateStructuredMetrics({
        cropType: 'Sunflower',
        pesticideMlHa: 500,
        floweringOrPollinatorsPresent: true,
      });

      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.includes('Pollinator safety violation'))).toBe(true);
    });
  });
});

