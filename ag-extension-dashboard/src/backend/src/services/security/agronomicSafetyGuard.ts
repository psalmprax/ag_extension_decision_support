import { logger } from '@/utils/logger';
import { getAdvisoryMessages } from '@/services/knowledge/advisoryLanguage';
import {
  regulatoryProvenanceService,
  type RegulatoryDecision,
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

  private evaluateRegulatoryMetrics(metrics: AgronomicMetricInput, violations: string[]): RegulatoryDecision | undefined {
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
    return regulatoryDecision;
  }

  private validateSafetyBounds(metrics: AgronomicMetricInput, violations: string[]): void {
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
  }

  /**
   * Validates structured numerical agronomic metrics against hard safety ceilings
   * and authoritative regulatory provenance rules.
   */
  validateStructuredMetrics(metrics: AgronomicMetricInput): AgronomicBoundaryCheck {
    const violations: string[] = [];
    const quarantineDiseases = AgronomicSafetyGuard.detectQuarantineConditions(metrics.identifiedPestsOrDiseases ?? []);

    const regulatoryDecision = this.evaluateRegulatoryMetrics(metrics, violations);

    this.validateSafetyBounds(metrics, violations);

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

    // Open-ended advice has no validated product/soil-test context. A plausible
    // rate is not an authorized rate, including botanical pesticides and lime.
    const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').toLowerCase();
    const treatmentPattern = /(?:\b(?:pesticid\w*|fungicid\w*|insecticid\w*|herbicid\w*|fertiliz\w*|fertilis\w*|urea|lime|neem|azadirachtin|mancozeb|chlorpyrifos|mbolea|chokaa|mwarobaini|engrais|fongicide|pestizid\w*|calcário|adubo\w*|concim\w*|meststof\w*|kireç|umanyolo|umcako|kalk|mocznik)\b|dünger|gübre|gødning|pestycyd|nawóz|nawoz|wapn|növényvéd|műtrágya|mész|îngrăș|ingras|hnojiv|vápn|pesticíd|कीटनाशक|उर्वरक|खाद|चूना|नीम|杀虫剂|農薬|农药|肥料|石灰|пестицид|фунгицид|инсектицид|гербицид|удобрени|добрив|сечовин|мочевин|извест|вапн|урея|торове|φυτοφαρμάκ|λιπασμ|λίπασμα|ασβέστ|مبيد|سماد|الأسمدة|الجير|ئوغۇت|ھاشارات دورىسى|ھاك)/iu;
    const chemicalTreatmentPattern = /(?:\b(?:pesticid\w*|fungicid\w*|insecticid\w*|herbicid\w*|neem|azadirachtin|mancozeb|chlorpyrifos|mwarobaini|fongicide|pestizid\w*|pestycyd|növényvéd|pesticíd|कीटनाशक|नीम|杀虫剂|農薬|农药|пестицид|фунгицид|инсектицид|гербицид|φυτοφαρμάκ|مبيد|ھاشارات دورىسى)\b)/iu;
    const quantity = String.raw`(?:\p{Nd}+(?:[.,]\p{Nd}+)?|[一二三四五六七八九十百半]+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|un|une|deux|trois|quatre|cinq|demi|uno|una|dos|tres|cuatro|cinco|medio|um|uma|dois|duas|três|quatro|meio|ein|eine|zwei|drei|vier|fünf|halb|moja|mbili|tatu|nne|tano|nusu|due|tre|quattro|een|twee|drie|vijf|bir|iki|üç|dört|beş|en|et|to|fire|fem|halv|dwa|dwie|trzy|cztery|pięć|pół|egy|két|kettő|három|négy|öt|fél|doi|două|trei|patru|cinci|jumătate|dva|dvě|tři|čtyři|pět|dve|tri|štyri|päť)\b|एक|दो|तीन|चार|पांच|पाँच|आधा|واحد|اثنين|ثلاثة|نصف|один|одна|два|две|три|четыре|половин|дві|чотири|един|една|четири|ένα|μία|δύο|τρία|τρεις|τέσσερα|μισό|بىر|ئىككى|ئۈچ|تۆت|بەش|يېرىم)`;
    const unit = String.raw`(?:(?:ml|l|g|kg|lit\p{L}*|gram\p{L}*|kilogram\p{L}*|mililit\p{L}*|tonnes?|tons?|tani|lita|kilogramu|quilos?|kilo|teaspoons?|tablespoons?|spoonfuls?|bottle[- ]?caps?)\b|मिलीलीटर|मिलिलीटर|लीटर|ग्राम|किलोग्राम|毫升|公升|升|公斤|千克|克|миллилитр|миллилитров|літр|литр|грамм|кілограм|килограмм|λίτρ|γραμμάρ|χιλιοστόλιτρ|ملليلتر|مليلتر|لتر|غرام|كيلوغرام|مىللىلىتىر|لىتىر|گرام|كىلوگرام|٪|%)`;
    // Percentages of crop populations describe scouting, not product concentration.
    // Leave all other percentages and physical dose units subject to withholding.
    const doseText = normalized.replace(
      /\p{Nd}+(?:[.,]\p{Nd}+)?\s*(?:%|٪)\s*(?:of\s+(?:(?:the|sampled|inspected|affected|infested|damaged)\s+)*(?:plants|leaves|whorls?|seedlings?|stems?|ears?|pods?)\b|(?:affected|infested|damaged)\s+plants\b|(?:plants|leaves|whorls?|seedlings?|stems?|ears?|pods?)\s+(?:affected|infested|damaged)\b|infestation\b|incidence\b)/giu,
      ''
    ).replace(
      new RegExp(`\\b(?:yield|harvest|production)\\s+(?:of\\s+)?${quantity}\\s*(?:tonnes?|tons?|kg)\\s*(?:\\/|per)\\s*(?:ha|hectares?|acres?)`, 'giu'),
      ''
    );
    const doseExpression = `(?:${quantity}\\s*(?:${unit})|(?:${unit})\\s*${quantity})`;
    const dosePattern = new RegExp(doseExpression, 'iu');
    const areaOrMixtureRatePattern = /\p{Nd}+(?:[.,]\p{Nd}+)?\s*(?:ml|l|g|kg|liters?|litres?|tonnes?)\s*(?:\/|per)\s*(?:ha|hectares?|acres?|l|liters?|litres?|kg)\b/iu;
    const applicationInstruction = /(?:\b(?:apply|mix|dilute|dose|dosage|spray|concentrat\w*|tumia|changanya|appliqu\w*|aplicar|mezclar|dosier\w*|anwenden|aplique|mistur\w*|mescol\w*|meng|uygula\w*)\b|मिलाकर|छिड़क|डाल|喷洒|加入|施用|смеш|примен|оброб|اخلط|رش)/iu;
    const unsafeRatePattern = new RegExp(
      `(?:${treatmentPattern.source}.{0,48}${doseExpression}|${doseExpression}.{0,48}${treatmentPattern.source})`,
      'iu'
    );
    const actionableAreaRatePattern = new RegExp(
      `(?:${applicationInstruction.source}.{0,32}${areaOrMixtureRatePattern.source}|${areaOrMixtureRatePattern.source}.{0,32}${applicationInstruction.source})`,
      'iu'
    );
    const adviceStatements = normalized.split(/(?<=[.!?;。！？])\s+|\n+/u);
    const screenedStatements = doseText.split(/(?<=[.!?;。！？])\s+|\n+/u);
    const hasUnsafeRate = screenedStatements.some(statement =>
      unsafeRatePattern.test(statement) && dosePattern.test(statement)
    ) || adviceStatements.some(statement =>
      actionableAreaRatePattern.test(statement) && areaOrMixtureRatePattern.test(statement)
    );
    if (hasUnsafeRate) {
      violations.push('Treatment rate withheld: current local label or soil-test authorization has not been established.');
      hazardLevel = 'critical_hazard';
    }
    const interval = /(?:\b(?:phi|rei|pre[- ]harvest|re[- ]entry|restricted[- ]entry|harvest|wait|waiting|attend\w*|récolte|cosecha|esper\w*|colheita|warte\w*|ernt\w*)\b|कटाई|प्रतीक्षा|采收|收获|等待|урожая|збирання|حصاد|انتظر)/iu;
    const duration = new RegExp(`${quantity}\\s*(?:days?|hours?|jours?|heures?|días?|horas?|dias?|giorni|ore|dagen|uur|tage[n]?|stunden|siku|saa|gün|saat|dage|timer|dni|godzin\\p{L}*|nap|óra|zile|ore|dní|hodin\\p{L}*|ημέρ\\p{L}*|ώρ\\p{L}*|दिन|घंटे|天|小时|дн\\p{L}*|час\\p{L}*|доби|годин\\p{L}*|أيام|يوم|ساعات|كۈن|سائەت)`, 'iu');
    if (adviceStatements.some(statement =>
      chemicalTreatmentPattern.test(statement) && interval.test(statement) && duration.test(statement)
    )) {
      violations.push('Product-specific harvest or re-entry interval requires the current locally registered label.');
      hazardLevel = 'critical_hazard';
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
   * Calibration requires measured equipment output and the registered label;
   * do not fabricate a generic conversion from area rates.
   */
  translateToKnapsackUnits(text: string): string {
    const ratePattern = /(\b\d+(?:\.\d+)?\s*(?:L|liters|litres|kg)\s*(?:\/|\s*per\s*)\s*(?:ha|hectare|acre)\b)/gi;
    const matches = text.match(ratePattern);
    if (!matches || matches.length === 0) return text;

    return `${text}\n\nCalibrate the actual sprayer with clean water and follow the current locally registered product label. Do not estimate doses using bottle caps or generic tank conversions.`;
  }

  /**
   * Applies safety notices, quarantine alerts, and knapsack guidance to generated advice text.
   */
  guardAndEnrichAdvice(text: string, language = 'en'): { text: string; boundaryCheck: AgronomicBoundaryCheck } {
    const boundaryCheck = this.scanGeneratedAdvice(text);
    let enriched = text;

    if (boundaryCheck.violations.length > 0) {
      logger.warn('Generated treatment instructions withheld by agronomic safety policy:', boundaryCheck.violations);
      enriched = getAdvisoryMessages(language).treatment;
      boundaryCheck.sanitizedAdvice = enriched;
    }

    if (boundaryCheck.quarantineAlert) {
      enriched += language === 'sw'
        ? '\n\nDalili zinaweza kuhusisha tatizo kubwa la afya ya mimea. Wasiliana na afisa ugani au mamlaka ya afya ya mimea kwa uthibitisho; hadhi ya karantini hutegemea nchi.'
        : '\n\nA potentially serious plant-health issue was mentioned. Contact the local extension or plant-health authority for confirmation; legal quarantine status depends on the country.';
    }

    const hasChemical = /\b(pesticide|fungicide|insecticide|herbicide|spray|spraying|chemical|malathion|chlorpyrifos|mancozeb|dimethoate|deltamethrin|lambda)\b/i.test(text);

    if (hasChemical && boundaryCheck.violations.length === 0) {
      if (!/\b(pre-harvest interval|phi)\b/i.test(text)) {
        enriched += `\n\n⏱️ **Pre-Harvest & Re-Entry Safety (PHI / REI)**:\n` +
          `• PHI and REI are product-, crop- and country-specific. Follow the current locally registered label; no universal waiting period is safe to assume.`;
      }

      if (/\b(flower|flowering|bloom|blooming|pollinat\w*|bee|bees)\b/i.test(text) && !/\b(pollinator safety|pollinator protection)\b/i.test(text)) {
        enriched += `\n\n🐝 **Pollinator & Bee Protection Warning**:\n` +
          `• Do NOT spray blooming crops or flowering weeds during daylight hours when honeybees and pollinators are actively foraging.\n` +
          `• Follow the label's pollinator restrictions. Spraying at dusk is not automatically safe.`;
      }
    }

    return { text: enriched, boundaryCheck };
  }
}

export const agronomicSafetyGuard = AgronomicSafetyGuard.getInstance();
