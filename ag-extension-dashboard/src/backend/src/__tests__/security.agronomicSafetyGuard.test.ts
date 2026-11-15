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
      expect(result.violations.some((v) => v.includes('Treatment rate withheld'))).toBe(true);
    });

    it('should withhold plausible but unverified pesticide rates', () => {
      const safeAiText =
        'Apply 1.5 L/ha of approved bio-pesticide early in the morning, followed by light irrigation.';
      const result = agronomicSafetyGuard.scanGeneratedAdvice(safeAiText);

      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('does not replace seasonal guidance because a separate sentence mentions crop yield and fertilizer', () => {
      const seasonalAnswer =
        'West Africa has several rainfall zones, so planting timing varies by country and locality. A historical fertilizer trial reported maize yield of 2.5 tonnes per hectare. Check the current local rainfall outlook before sowing.';
      const result = agronomicSafetyGuard.guardAndEnrichAdvice(seasonalAnswer);

      expect(result.boundaryCheck.safe).toBe(true);
      expect(result.text).toBe(seasonalAnswer);
    });

    it('still withholds an unverified pesticide rate even when the answer includes useful planting context', () => {
      const answer =
        'Rainfed planting follows reliable local rainfall. Apply neem at 3 ml/L to control pests.';
      const result = agronomicSafetyGuard.guardAndEnrichAdvice(answer);

      expect(result.boundaryCheck.safe).toBe(false);
      expect(result.text).not.toContain('3 ml/L');
    });
  });

  describe('3. Knapsack Sprayer Calibration & Advice Enrichment', () => {
    it('should append knapsack sprayer calibration when application rates are mentioned', () => {
      const advice = 'Apply 2.5 L/ha of contact fungicide across the affected area.';
      const enriched = agronomicSafetyGuard.translateToKnapsackUnits(advice);

      expect(enriched).toContain('Calibrate the actual sprayer');
      expect(enriched).not.toContain('200–250');
    });

    it('should remove lethal dosage text instead of returning it below a warning', () => {
      const hazardousAdvice = 'Apply 30 Liters per hectare of pesticide solution to control the pest.';
      const { text, boundaryCheck } = agronomicSafetyGuard.guardAndEnrichAdvice(hazardousAdvice);

      expect(boundaryCheck.safe).toBe(false);
      expect(text).toContain('cannot verify');
      expect(text).not.toContain('30 Liters');
    });

    it('should prepend quarantine alert when high-consequence pathogen is detected in advice', () => {
      const quarantineAdvice = 'Symptoms match maize lethal necrosis disease in the lower parcel.';
      const { text, boundaryCheck } = agronomicSafetyGuard.guardAndEnrichAdvice(quarantineAdvice);

      expect(boundaryCheck.quarantineAlert).toBe(true);
      expect(text).toContain('legal quarantine status depends on the country');
      expect(text).toContain('maize lethal necrosis');
    });

    it('should append Pre-Harvest Interval (PHI) and Pollinator safety warnings for chemical recommendations', () => {
      const chemicalAdvice = 'Any pesticide decision during flowering needs local label review.';
      const { text } = agronomicSafetyGuard.guardAndEnrichAdvice(chemicalAdvice);

      expect(text).toContain('Pre-Harvest & Re-Entry Safety (PHI / REI)');
      expect(text).toContain('Pollinator & Bee Protection Warning');
      expect(text).not.toContain('7–14 days');
      expect(text).not.toContain('24–48 hours');
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
