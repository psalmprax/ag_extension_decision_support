import { logger } from '@/utils/logger';

export interface AgronomicBoundaryCheck {
  safe: boolean;
  violations: string[];
  quarantineAlert: boolean;
  quarantineDiseases: string[];
  sanitizedAdvice?: string;
  hazardLevel: 'safe' | 'warning' | 'critical_hazard';
}

export interface AgronomicMetricInput {
  cropType?: string;
  nitrogenKgHa?: number;
  phosphorusKgHa?: number;
  potassiumKgHa?: number;
  pesticideMlHa?: number;
  pesticideName?: string;
  soilPh?: number;
  identifiedPestsOrDiseases?: string[];
}

export class AgronomicSafetyGuard {
  private static instance: AgronomicSafetyGuard;

  // Maximum safe upper boundaries based on FAO & Ministry of Agriculture agronomic guidelines
  private static readonly SAFETY_BOUNDS = {
    nitrogenMaxKgHa: 300,
    phosphorusMaxKgHa: 150,
    potassiumMaxKgHa: 200,
    pesticideMaxMlHa: 4000, // 4 Liters / ha max active ingredient for smallholders
    minSoilPh: 3.5,
    maxSoilPh: 9.5,
  };

  // High-consequence quarantine diseases requiring supervisor escalation & state containment
  private static readonly QUARANTINE_DISEASES = [
    'maize lethal necrosis',
    'banana bacterial wilt',
    'xanthomonas wilt',
    'cassava brown streak',
    'coffee wilt disease',
    'fall armyworm outbreak',
    'swarms of desert locust',
  ];

  static getInstance(): AgronomicSafetyGuard {
    if (!AgronomicSafetyGuard.instance) {
      AgronomicSafetyGuard.instance = new AgronomicSafetyGuard();
    }
    return AgronomicSafetyGuard.instance;
  }

  private static detectQuarantineConditions(conditions: string[]): string[] {
    const found: string[] = [];
    for (const condition of conditions) {
      const lower = condition.toLowerCase();
      for (const quarantine of AgronomicSafetyGuard.QUARANTINE_DISEASES) {
        if (lower.includes(quarantine)) found.push(quarantine);
      }
    }
    return found;
  }

  private static computeHazardLevel(
    violations: string[],
    quarantineDiseases: string[]
  ): 'safe' | 'warning' | 'critical_hazard' {
    if (quarantineDiseases.length > 0) return 'critical_hazard';
    const hasCritical = violations.some(
      v => v.startsWith('Excessive Nitrogen') || v.startsWith('Lethal pesticide')
    );
    if (hasCritical) return 'critical_hazard';
    return violations.length > 0 ? 'warning' : 'safe';
  }

  /**
   * Validates structured numerical agronomic metrics against hard safety ceilings.
   */
  validateStructuredMetrics(metrics: AgronomicMetricInput): AgronomicBoundaryCheck {
    const violations: string[] = [];
    const quarantineDiseases = AgronomicSafetyGuard.detectQuarantineConditions(metrics.identifiedPestsOrDiseases ?? []);

    // 1. Nitrogen validation
    if (metrics.nitrogenKgHa !== undefined && metrics.nitrogenKgHa > AgronomicSafetyGuard.SAFETY_BOUNDS.nitrogenMaxKgHa) {
      violations.push(
        `Excessive Nitrogen dosage: ${metrics.nitrogenKgHa} kg/ha exceeds safe ceiling of ${AgronomicSafetyGuard.SAFETY_BOUNDS.nitrogenMaxKgHa} kg/ha (Risk of crop burn & groundwater contamination)`
      );
    }

    // 2. Phosphorus validation
    if (metrics.phosphorusKgHa !== undefined && metrics.phosphorusKgHa > AgronomicSafetyGuard.SAFETY_BOUNDS.phosphorusMaxKgHa) {
      violations.push(
        `Excessive Phosphorus dosage: ${metrics.phosphorusKgHa} kg/ha exceeds safe ceiling of ${AgronomicSafetyGuard.SAFETY_BOUNDS.phosphorusMaxKgHa} kg/ha`
      );
    }

    // 3. Pesticide application rate validation
    if (metrics.pesticideMlHa !== undefined && metrics.pesticideMlHa > AgronomicSafetyGuard.SAFETY_BOUNDS.pesticideMaxMlHa) {
      violations.push(
        `Lethal pesticide dosage: ${metrics.pesticideMlHa} mL/ha exceeds maximum safe application threshold of ${AgronomicSafetyGuard.SAFETY_BOUNDS.pesticideMaxMlHa} mL/ha (High risk of phytotoxicity & toxicity)`
      );
    }

    // 4. Soil pH range
    if (metrics.soilPh !== undefined && (metrics.soilPh < AgronomicSafetyGuard.SAFETY_BOUNDS.minSoilPh || metrics.soilPh > AgronomicSafetyGuard.SAFETY_BOUNDS.maxSoilPh)) {
      violations.push(`Unrealistic or extreme Soil pH: ${metrics.soilPh} (Valid arable range is 3.5 - 9.5)`);
    }

    const hazardLevel = AgronomicSafetyGuard.computeHazardLevel(violations, quarantineDiseases);
    const safe = violations.length === 0 && quarantineDiseases.length === 0;

    if (!safe) {
      logger.warn(`AgronomicSafetyGuard: Hazard detected (${hazardLevel}) — Violations: ${violations.join('; ')}`);
    }

    return {
      safe,
      violations,
      quarantineAlert: quarantineDiseases.length > 0,
      quarantineDiseases,
      hazardLevel,
    };
  }

  /**
   * Scans unstructured LLM generated text for lethal/excessive chemical recommendations.
   */
  scanGeneratedAdvice(text: string): AgronomicBoundaryCheck {
    const violations: string[] = [];
    const quarantineDiseases: string[] = [];
    let hazardLevel: 'safe' | 'warning' | 'critical_hazard' = 'safe';

    // Regex to capture excessive dosage patterns like "50 L/ha", "500 kg of urea", "10000 ml/ha"
    const excessiveLiquidPattern = /(\b\d{2,}\s*(?:liters|litres|L)\s*(?:\/|\s*per\s*)\s*(?:ha|hectare|acre)\b)/gi;
    const matchesLiquid = text.match(excessiveLiquidPattern);
    if (matchesLiquid) {
      for (const m of matchesLiquid) {
        const num = parseFloat(m.replace(/[^\d.]/g, ''));
        if (num >= 15) { // 15+ Liters per hectare of concentrated chemical is hazardous
          violations.push(`Potentially lethal liquid dosage recommendation detected: "${m}"`);
          hazardLevel = 'critical_hazard';
        }
      }
    }

    // Check for quarantine outbreaks mentioned in advice
    const lowerText = text.toLowerCase();
    for (const q of AgronomicSafetyGuard.QUARANTINE_DISEASES) {
      if (lowerText.includes(q)) {
        quarantineDiseases.push(q);
        if (hazardLevel !== 'critical_hazard') hazardLevel = 'critical_hazard';
      }
    }

    return {
      safe: violations.length === 0 && quarantineDiseases.length === 0,
      violations,
      quarantineAlert: quarantineDiseases.length > 0,
      quarantineDiseases,
      hazardLevel,
    };
  }
}

export const agronomicSafetyGuard = AgronomicSafetyGuard.getInstance();
