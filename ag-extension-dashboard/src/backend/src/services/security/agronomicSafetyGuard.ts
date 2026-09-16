import { logger } from '@/utils/logger';
import {
  regulatoryProvenanceService,
  RegulatoryDecision,
} from '@/services/regulatoryProvenanceService';

export interface AgronomicBoundaryCheck {
  safe: boolean;
  violations: string[];
  quarantineAlert: boolean;
  quarantineDiseases: string[];
  sanitizedAdvice?: string;
  hazardLevel: 'safe' | 'warning' | 'critical_hazard';
  regulatoryDecision?: RegulatoryDecision;
}

export interface AgronomicMetricInput {
  cropType?: string;
  cropStage?: string;
  daysToHarvest?: number;
  floweringOrPollinatorsPresent?: boolean;
  nitrogenKgHa?: number;
  phosphorusKgHa?: number;
  potassiumKgHa?: number;
  pesticideMlHa?: number;
  pesticideName?: string;
  soilPh?: number;
  identifiedPestsOrDiseases?: string[];
  jurisdiction?: string;
  farmerId?: string;
  officerId?: string;
  formulation?: 'WP' | 'WG' | 'EC' | 'SC' | 'SL' | 'GR' | 'DP';
  applicationMethod?: 'knapsack_foliar' | 'boom_spray' | 'soil_drench' | 'seed_treatment';
  adviceTimestamp?: string;
  clientOfflineContext?: {
    isOffline: boolean;
    cachedDatasetVersion: string;
    cachedDatasetTimestamp: string;
  };
}

class AgronomicSafetyGuard {
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
      v =>
        v.startsWith('Excessive Nitrogen') ||
        v.startsWith('Lethal pesticide') ||
        v.startsWith('Pre-Harvest Interval') ||
        v.startsWith('PROHIBITED SUBSTANCE') ||
        v.includes('strictly rejected') ||
        v.includes('Regulatory authorization rejected') ||
        v.includes('Off-label') ||
        v.includes('POLLINATOR LOCKOUT')
    );
    if (hasCritical) return 'critical_hazard';
    return violations.length > 0 ? 'warning' : 'safe';
  }

  /**
   * Validates structured numerical agronomic metrics against hard safety ceilings
   * and authoritative regulatory provenance rules.
   */
  validateStructuredMetrics(metrics: AgronomicMetricInput): AgronomicBoundaryCheck {
    const violations: string[] = [];
    const quarantineDiseases = AgronomicSafetyGuard.detectQuarantineConditions(metrics.identifiedPestsOrDiseases ?? []);

    // 1. Authoritative Regulatory Decision Service Evaluation (AD-001)
    let regulatoryDecision: RegulatoryDecision | undefined;
    if (metrics.jurisdiction && (metrics.pesticideName || (metrics.pesticideMlHa && metrics.pesticideMlHa > 0))) {
      regulatoryDecision = regulatoryProvenanceService.evaluateRecommendation({
        jurisdiction: metrics.jurisdiction,
        crop: metrics.cropType || 'general',
        pestOrDisease: (metrics.identifiedPestsOrDiseases && metrics.identifiedPestsOrDiseases[0]) || 'general_pest',
        treatmentTradeNameOrIngredient: metrics.pesticideName || 'unspecified_pesticide',
        formulation: metrics.formulation,
        doseGramsOrMlHa: metrics.pesticideMlHa || 0,
        applicationMethod: metrics.applicationMethod,
        daysToHarvest: metrics.daysToHarvest,
        floweringPresent: metrics.floweringOrPollinatorsPresent,
        pollinatorsPresent: metrics.floweringOrPollinatorsPresent,
        adviceTimestamp: metrics.adviceTimestamp,
        farmerId: metrics.farmerId || 'unknown_farmer',
        officerId: metrics.officerId || 'unknown_officer',
        clientOfflineContext: metrics.clientOfflineContext,
      });

      if (regulatoryDecision.status === 'HARD_REJECTION') {
        violations.push(regulatoryDecision.rejectionMessage || 'Regulatory authorization rejected under fail-closed governance.');
      }
    }

    // 2. Nitrogen validation
    if (metrics.nitrogenKgHa !== undefined && metrics.nitrogenKgHa > AgronomicSafetyGuard.SAFETY_BOUNDS.nitrogenMaxKgHa) {
      violations.push(
        `Excessive Nitrogen dosage: ${metrics.nitrogenKgHa} kg/ha exceeds safe ceiling of ${AgronomicSafetyGuard.SAFETY_BOUNDS.nitrogenMaxKgHa} kg/ha (Risk of crop burn & groundwater contamination)`
      );
    }

    // 3. Phosphorus validation
    if (metrics.phosphorusKgHa !== undefined && metrics.phosphorusKgHa > AgronomicSafetyGuard.SAFETY_BOUNDS.phosphorusMaxKgHa) {
      violations.push(
        `Excessive Phosphorus dosage: ${metrics.phosphorusKgHa} kg/ha exceeds safe ceiling of ${AgronomicSafetyGuard.SAFETY_BOUNDS.phosphorusMaxKgHa} kg/ha`
      );
    }

    // 4. Baseline heuristic pesticide application rate validation
    if (metrics.pesticideMlHa !== undefined && metrics.pesticideMlHa > AgronomicSafetyGuard.SAFETY_BOUNDS.pesticideMaxMlHa) {
      violations.push(
        `Lethal pesticide dosage: ${metrics.pesticideMlHa} mL/ha exceeds maximum safe application threshold of ${AgronomicSafetyGuard.SAFETY_BOUNDS.pesticideMaxMlHa} mL/ha (High risk of phytotoxicity & toxicity)`
      );
    }

    // 5. Soil pH range
    if (metrics.soilPh !== undefined && (metrics.soilPh < AgronomicSafetyGuard.SAFETY_BOUNDS.minSoilPh || metrics.soilPh > AgronomicSafetyGuard.SAFETY_BOUNDS.maxSoilPh)) {
      violations.push(`Unrealistic or extreme Soil pH: ${metrics.soilPh} (Valid arable range is 3.5 - 9.5)`);
    }

    // 6. Pre-Harvest Interval (PHI) check (Baseline heuristic fallback if regulatory record absent)
    if (!regulatoryDecision && metrics.daysToHarvest !== undefined && metrics.daysToHarvest < 7 && (metrics.pesticideMlHa !== undefined && metrics.pesticideMlHa > 0)) {
      violations.push(
        `Pre-Harvest Interval (PHI) violation: Chemical application scheduled ${metrics.daysToHarvest} days before harvest (Minimum safe PHI is 7–14 days to prevent toxic residues in consumed produce)`
      );
    }

    // 7. Pollinator & Flowering safety check (Baseline heuristic fallback if regulatory record absent)
    if (!regulatoryDecision && metrics.floweringOrPollinatorsPresent && (metrics.pesticideMlHa !== undefined && metrics.pesticideMlHa > 0)) {
      violations.push(
        `Pollinator safety violation: Insecticide/pesticide spraying during flowering or active pollinator foraging creates severe bee mortality risk (Apply only during late evening hours when bees are inactive)`
      );
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
      regulatoryDecision,
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

  /**
   * Translates scientific application rates into practical knapsack sprayer operational units
   * (16L/20L knapsacks, bottle-caps ~10-20ml, matchbox micro-doses).
   */
  translateToKnapsackUnits(text: string): string {
    const ratePattern = /(\b\d+(?:\.\d+)?\s*(?:L|liters|litres|kg)\s*(?:\/|\s*per\s*)\s*(?:ha|hectare|acre)\b)/gi;
    const matches = text.match(ratePattern);
    if (!matches || matches.length === 0) return text;

    let enriched = text;
    if (!text.toLowerCase().includes('knapsack')) {
      enriched += `\n\n📌 **Knapsack Sprayer Calibration (Field Guidance)**:\n` +
        `• Standard knapsack volume: 16L or 20L. Typical spray volume is 200–250 L of water per hectare (~10–12 full knapsacks/ha).\n` +
        `• Always wear personal protective equipment (gloves, mask, boots). Never spray against the wind or during hot midday hours.`;
    }
    return enriched;
  }

  /**
   * Applies safety notices, quarantine alerts, and knapsack guidance to generated advice text.
   */
  guardAndEnrichAdvice(text: string): { text: string; boundaryCheck: AgronomicBoundaryCheck } {
    const boundaryCheck = this.scanGeneratedAdvice(text);
    let enriched = text;

    if (!boundaryCheck.safe) {
      const alertPrefix: string[] = [];
      if (boundaryCheck.violations.length > 0) {
        alertPrefix.push(`⚠️ **AGRONOMIC DOSAGE WARNING**: ${boundaryCheck.violations.join('; ')}. Verify with local certified agricultural extension officer before application.`);
      }
      if (boundaryCheck.quarantineAlert) {
        alertPrefix.push(`🚨 **QUARANTINE ALERT**: High-consequence pathogen detected (${boundaryCheck.quarantineDiseases.join(', ')}). Immediate reporting to county agricultural officer required.`);
      }
      enriched = `${alertPrefix.join('\n\n')}\n\n${enriched}`;
    }

    enriched = this.translateToKnapsackUnits(enriched);

    const lowerText = text.toLowerCase();
    const hasChemical = /\b(pesticide|fungicide|insecticide|herbicide|spray|spraying|chemical|malathion|chlorpyrifos|mancozeb|dimethoate|deltamethrin|lambda)\b/i.test(text);

    if (hasChemical) {
      if (!/\b(pre-harvest interval|phi)\b/i.test(text)) {
        enriched += `\n\n⏱️ **Pre-Harvest & Re-Entry Safety (PHI / REI)**:\n` +
          `• Pre-Harvest Interval (PHI): Observe mandatory minimum 7–14 days between chemical application and harvesting food crops.\n` +
          `• Restricted-Entry Interval (REI): Keep people and livestock out of treated fields for at least 24–48 hours unless wearing full PPE.`;
      }

      if (/\b(flower|flowering|bloom|blooming|pollinat\w*|bee|bees)\b/i.test(text) && !/\b(pollinator safety|pollinator protection)\b/i.test(text)) {
        enriched += `\n\n🐝 **Pollinator & Bee Protection Warning**:\n` +
          `• Do NOT spray blooming crops or flowering weeds during daylight hours when honeybees and pollinators are actively foraging.\n` +
          `• If treatment is urgent, apply strictly at dusk or late evening to minimize pollinator colony collapse.`;
      }
    }

    return { text: enriched, boundaryCheck };
  }
}

export const agronomicSafetyGuard = AgronomicSafetyGuard.getInstance();
