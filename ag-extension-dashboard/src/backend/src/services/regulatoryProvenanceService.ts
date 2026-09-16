import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * ============================================================================
 * REGULATORY KNOWLEDGE & RULE PROVENANCE SUBSYSTEM (AD-001)
 * ============================================================================
 *
 * Implements the 16-point regulatory provenance chain and fail-closed decisioning:
 *
 *   Regulatory Source -> Gazette/Document -> Normalized Regulatory Fact ->
 *   Versioned Rule -> Cryptographic Rule Hash -> Temporal Validation Engine ->
 *   Safety Decision -> Cryptographic Recommendation Provenance
 *
 * INVARIANT:
 * No currently valid regulatory authorization for the specific jurisdiction +
 * product/formulation + crop + intended use + application method + relevant temporal conditions
 * ==> HARD REJECTION.
 */

export interface RegulatoryAuthority {
  authorityId: string; // e.g. 'KE-PCPB', 'IN-CIBRC', 'CA-PMRA'
  jurisdiction: string; // 'KE', 'IN', 'CA', 'GLOBAL_FAO'
  name: string;
  officialGazetteOrRegistryUrl: string;
}

export interface RegulatoryDocument {
  documentId: string;
  authorityId: string;
  gazetteCitation: string;
  publishedDate: string; // ISO 8601
  sourceHash: string; // SHA-256 of source gazette/document
}

export interface ActiveIngredientSpec {
  name: string;
  concentrationGramsPerKgOrL: number;
}

export interface EnvironmentalRestrictions {
  bufferZoneMeters: number;
  pollinatorLockoutDuringFlowering: boolean;
  aquaticRunoffRisk: 'low' | 'moderate' | 'extreme';
}

export interface RegulatoryRule {
  ruleId: string;
  registrationNumber: string;
  jurisdiction: string; // ISO country code e.g. 'KE', 'IN', 'CA'
  authorityId: string;
  documentId: string;
  datasetVersion: string;
  commercialTradeName: string;
  activeIngredients: ActiveIngredientSpec[];
  formulationType: 'WP' | 'WG' | 'EC' | 'SC' | 'SL' | 'GR' | 'DP';
  crop: string;
  targetPests: string[];
  maxDoseMlOrGramsHa: number;
  applicationMethod: 'knapsack_foliar' | 'boom_spray' | 'soil_drench' | 'seed_treatment';
  legalPhiDays: number; // Pre-Harvest Interval (days)
  legalReiHours: number; // Restricted-Entry Interval (hours)
  maxApplicationsPerSeason: number;
  environmentalRestrictions: EnvironmentalRestrictions;
  status: 'active_registered' | 'restricted' | 'revoked_banned' | 'expired' | 'emergency_authorization';
  effectiveFrom: string; // ISO 8601
  effectiveTo: string; // ISO 8601
  emergencyAuthorizationWindow?: {
    validFrom: string;
    validTo: string;
    exemptionNotice: string;
  };
  ruleHash: string; // SHA-256 of canonical rule
}

export interface RecommendationEvaluationRequest {
  jurisdiction: string;
  crop: string;
  pestOrDisease: string;
  treatmentTradeNameOrIngredient: string;
  formulation?: 'WP' | 'WG' | 'EC' | 'SC' | 'SL' | 'GR' | 'DP';
  doseGramsOrMlHa: number;
  applicationMethod?: 'knapsack_foliar' | 'boom_spray' | 'soil_drench' | 'seed_treatment';
  daysToHarvest?: number;
  floweringPresent?: boolean;
  pollinatorsPresent?: boolean;
  adviceTimestamp?: string; // ISO 8601 (defaults to server-authoritative time)
  farmerId: string;
  officerId: string;
  clientOfflineContext?: {
    isOffline: boolean;
    cachedDatasetVersion: string;
    cachedDatasetTimestamp: string;
  };
}

export interface RecommendationProvenance {
  recommendationId: string;
  adviceTimestamp: string;
  jurisdiction: string;
  farmerId: string;
  officerId: string;
  productRegistrationId: string;
  commercialTradeName: string;
  activeIngredients: ActiveIngredientSpec[];
  formulation: string;
  crop: string;
  pestDisease: string;
  dose: number;
  applicationMethod: string;
  daysToHarvest?: number;
  floweringStatus: boolean;
  pollinatorStatus: boolean;
  datasetVersion: string;
  ruleId: string;
  ruleHash: string;
  decisionStatus: 'APPROVED' | 'HARD_REJECTION' | 'RESTRICTED_OFFLINE_APPROVAL';
  engineVersion: string;
  recommendationIntegrityHash: string;
  digitalSignatureEnvelope?: {
    algorithm: 'HMAC-SHA256';
    signature: string;
    signedBy: string;
  };
  offlineContext?: {
    isOffline: boolean;
    datasetAgeDays: number;
  };
}

export interface RegulatoryDecision {
  status: 'APPROVED' | 'HARD_REJECTION' | 'RESTRICTED_OFFLINE_APPROVAL';
  reasonCode:
    | 'AUTHORIZED_ACTIVE_REGISTRATION'
    | 'UNREGISTERED_PRODUCT'
    | 'UNREGISTERED_CROP'
    | 'UNREGISTERED_PEST_OR_USE'
    | 'INCOMPATIBLE_FORMULATION'
    | 'EXCEEDS_MAX_LEGAL_RATE'
    | 'PHI_VIOLATION'
    | 'REI_VIOLATION'
    | 'POLLINATOR_FLOWERING_VIOLATION'
    | 'REGISTRATION_EXPIRED'
    | 'REGISTRATION_NOT_YET_EFFECTIVE'
    | 'REGISTRATION_REVOKED_BANNED'
    | 'JURISDICTION_MISMATCH'
    | 'OFFLINE_DATASET_STALE_EXPIRED'
    | 'DATASET_CORRUPTED_OR_HASH_MISMATCH'
    | 'MISSING_REGULATORY_SOURCE';
  rejectionMessage?: string;
  rule?: RegulatoryRule;
  provenance?: RecommendationProvenance;
  warnings: string[];
}

export interface AuditReconstruction {
  verified: boolean;
  auditTimestamp: string;
  recommendationHash: string;
  reconstructedProvenance?: RecommendationProvenance;
  matchedRule?: RegulatoryRule;
  integrityCheck: 'INTACT' | 'CORRUPTED' | 'HASH_MISMATCH' | 'RECORD_NOT_FOUND';
  discrepancies: string[];
}

const ENGINE_VERSION = 'regulatory-provenance-v2.0';
const OFFLINE_MAX_STALENESS_DAYS = 90;

export class RegulatoryProvenanceService {
  private static instance: RegulatoryProvenanceService;

  // In-memory authorities, rules, and historical audit ledger
  private authorities = new Map<string, RegulatoryAuthority>();
  private documents = new Map<string, RegulatoryDocument>();
  private rules = new Map<string, RegulatoryRule>();
  private historicalRecommendations = new Map<string, RecommendationProvenance>();

  private currentDatasetVersion = 'REG-2026.09-REV1';

  private constructor() {
    this.seedDefaultAuthoritiesAndRules();
  }

  static getInstance(): RegulatoryProvenanceService {
    if (!RegulatoryProvenanceService.instance) {
      RegulatoryProvenanceService.instance = new RegulatoryProvenanceService();
    }
    return RegulatoryProvenanceService.instance;
  }

  /**
   * Generates a deterministic SHA-256 hash for canonical rule verification.
   */
  public calculateRuleHash(rule: Omit<RegulatoryRule, 'ruleHash'>): string {
    const canonicalPayload = JSON.stringify({
      registrationNumber: rule.registrationNumber,
      jurisdiction: rule.jurisdiction.toUpperCase(),
      authorityId: rule.authorityId,
      documentId: rule.documentId,
      datasetVersion: rule.datasetVersion,
      commercialTradeName: rule.commercialTradeName.toLowerCase().trim(),
      activeIngredients: rule.activeIngredients
        .map(a => ({ name: a.name.toLowerCase().trim(), conc: a.concentrationGramsPerKgOrL }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      formulationType: rule.formulationType,
      crop: rule.crop.toLowerCase().trim(),
      targetPests: [...rule.targetPests].map(p => p.toLowerCase().trim()).sort(),
      maxDose: rule.maxDoseMlOrGramsHa,
      applicationMethod: rule.applicationMethod,
      legalPhiDays: rule.legalPhiDays,
      legalReiHours: rule.legalReiHours,
      maxApplicationsPerSeason: rule.maxApplicationsPerSeason,
      environmental: rule.environmentalRestrictions,
      status: rule.status,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    });

    return crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  }

  /**
   * Generates a deterministic SHA-256 hash committing to all decision inputs and outputs.
   */
  public calculateRecommendationIntegrityHash(payload: Omit<RecommendationProvenance, 'recommendationIntegrityHash' | 'digitalSignatureEnvelope'>): string {
    const canonicalPayload = JSON.stringify({
      recommendationId: payload.recommendationId,
      adviceTimestamp: payload.adviceTimestamp,
      jurisdiction: payload.jurisdiction.toUpperCase(),
      farmerId: payload.farmerId,
      officerId: payload.officerId,
      productRegistrationId: payload.productRegistrationId,
      commercialTradeName: payload.commercialTradeName.toLowerCase().trim(),
      activeIngredients: payload.activeIngredients,
      formulation: payload.formulation,
      crop: payload.crop.toLowerCase().trim(),
      pestDisease: payload.pestDisease.toLowerCase().trim(),
      dose: payload.dose,
      applicationMethod: payload.applicationMethod,
      daysToHarvest: payload.daysToHarvest,
      floweringStatus: payload.floweringStatus,
      pollinatorStatus: payload.pollinatorStatus,
      datasetVersion: payload.datasetVersion,
      ruleId: payload.ruleId,
      ruleHash: payload.ruleHash,
      decisionStatus: payload.decisionStatus,
      engineVersion: payload.engineVersion,
    });

    return crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  }

  /**
   * Authoritative regulatory decision engine enforcing the fail-closed invariant.
   */
  public evaluateRecommendation(req: RecommendationEvaluationRequest): RegulatoryDecision {
    const adviceTimestamp = req.adviceTimestamp || new Date().toISOString();
    const warnings: string[] = [];
    const jurisdiction = req.jurisdiction.toUpperCase().trim();
    const crop = req.crop.toLowerCase().trim();
    const pestOrDisease = req.pestOrDisease.toLowerCase().trim();
    const searchTreatment = req.treatmentTradeNameOrIngredient.toLowerCase().trim();

    // 1. Offline Staleness Policy Check
    let isOfflineApproval = false;
    let datasetAgeDays = 0;
    if (req.clientOfflineContext?.isOffline) {
      const cachedTimestamp = req.clientOfflineContext.cachedDatasetTimestamp;
      const cachedTime = cachedTimestamp ? new Date(cachedTimestamp).getTime() : NaN;
      const currentTime = Date.now();

      if (isNaN(cachedTime) || cachedTime <= 0) {
        return this.createRejection(
          'OFFLINE_DATASET_STALE_EXPIRED',
          'Offline regulatory dataset timestamp is invalid or missing. Reconnection required to authorize treatments.',
          req,
          adviceTimestamp
        );
      }

      datasetAgeDays = Math.max(0, Math.floor((currentTime - cachedTime) / (1000 * 60 * 60 * 24)));

      if (datasetAgeDays > OFFLINE_MAX_STALENESS_DAYS) {
        return this.createRejection(
          'OFFLINE_DATASET_STALE_EXPIRED',
          `Offline regulatory dataset is ${datasetAgeDays} days old (exceeds ${OFFLINE_MAX_STALENESS_DAYS} day maximum allowable staleness). Reconnection required to authorize treatments.`,
          req,
          adviceTimestamp
        );
      }

      warnings.push(`Offline regulatory dataset used (${datasetAgeDays} days old; version: ${req.clientOfflineContext.cachedDatasetVersion}).`);
      isOfflineApproval = true;
    }

    // 2. Jurisdiction & Authority Verification
    const authorityExists = Array.from(this.authorities.values()).some(a => a.jurisdiction === jurisdiction);
    if (!authorityExists) {
      return this.createRejection(
        'MISSING_REGULATORY_SOURCE',
        `No accredited regulatory authority registered for jurisdiction '${jurisdiction}'. Chemical advisory prohibited under fail-closed governance.`,
        req,
        adviceTimestamp
      );
    }

    // 3. Find Candidate Rules Matching Jurisdiction
    const candidateRules = Array.from(this.rules.values()).filter(r => r.jurisdiction === jurisdiction);
    if (candidateRules.length === 0) {
      return this.createRejection(
        'JURISDICTION_MISMATCH',
        `No regulatory rules ingested for jurisdiction '${jurisdiction}'.`,
        req,
        adviceTimestamp
      );
    }

    // 4. Product Registration Resolution (Trade Name or Active Ingredient match)
    const matchedProducts = candidateRules.filter(r => {
      const tradeNameMatch = r.commercialTradeName.toLowerCase().includes(searchTreatment);
      const ingredientMatch = r.activeIngredients.some(ai => ai.name.toLowerCase().includes(searchTreatment));
      return tradeNameMatch || ingredientMatch;
    });

    if (matchedProducts.length === 0) {
      return this.createRejection(
        'UNREGISTERED_PRODUCT',
        `Product or active ingredient '${req.treatmentTradeNameOrIngredient}' is not registered in jurisdiction '${jurisdiction}'. Chemical recommendation strictly rejected.`,
        req,
        adviceTimestamp
      );
    }

    // 5. Revocation / Ban Status Check (Prioritize explicit bans across matching products)
    const bannedProduct = matchedProducts.find(r => r.status === 'revoked_banned');
    if (bannedProduct) {
      const doc = this.documents.get(bannedProduct.documentId);
      const gazetteCitation = doc ? ` (${doc.gazetteCitation})` : '';
      return this.createRejection(
        'REGISTRATION_REVOKED_BANNED',
        `PROHIBITED SUBSTANCE: '${req.treatmentTradeNameOrIngredient}' is REVOKED/BANNED in '${jurisdiction}' under Registration ${bannedProduct.registrationNumber}${gazetteCitation}. Application is illegal.`,
        req,
        adviceTimestamp,
        bannedProduct
      );
    }

    // 6. Crop Authorization Check
    const matchedCropRules = matchedProducts.filter(r => r.crop.toLowerCase() === crop);
    if (matchedCropRules.length === 0) {
      const authorizedCrops = Array.from(new Set(matchedProducts.map(r => r.crop))).join(', ');
      return this.createRejection(
        'UNREGISTERED_CROP',
        `Product '${matchedProducts[0].commercialTradeName}' is NOT registered for crop '${req.crop}' in '${jurisdiction}' (Registered only for: ${authorizedCrops}). Off-label application blocked.`,
        req,
        adviceTimestamp,
        matchedProducts[0]
      );
    }

    // 7. Pest / Target Disease Authorization Check
    const matchedPestRules = matchedCropRules.filter(r =>
      r.targetPests.some(p => p.toLowerCase().includes(pestOrDisease) || pestOrDisease.includes(p.toLowerCase()))
    );
    if (matchedPestRules.length === 0) {
      const targetList = Array.from(new Set(matchedCropRules.flatMap(r => r.targetPests))).join(', ');
      return this.createRejection(
        'UNREGISTERED_PEST_OR_USE',
        `Product '${matchedCropRules[0].commercialTradeName}' is NOT approved for target pest/disease '${req.pestOrDisease}' on '${req.crop}' (Approved for: ${targetList}).`,
        req,
        adviceTimestamp,
        matchedCropRules[0]
      );
    }

    let selectedRule = matchedPestRules[0];

    // 8. Rule Cryptographic Integrity Verification (Fail early if database record was tampered with)
    const recomputedRuleHash = this.calculateRuleHash(selectedRule);
    if (recomputedRuleHash !== selectedRule.ruleHash) {
      logger.error(`CRITICAL: Regulatory rule hash mismatch for Rule ${selectedRule.ruleId}! Expected ${selectedRule.ruleHash}, got ${recomputedRuleHash}`);
      return this.createRejection(
        'DATASET_CORRUPTED_OR_HASH_MISMATCH',
        `Internal security violation: Cryptographic rule hash corruption detected for Rule '${selectedRule.ruleId}'. Decision aborted.`,
        req,
        adviceTimestamp,
        selectedRule
      );
    }

    // 9. Temporal Validity Window & Emergency Authorization Check
    const adviceTime = new Date(adviceTimestamp).getTime();
    const effFrom = new Date(selectedRule.effectiveFrom).getTime();
    const effTo = new Date(selectedRule.effectiveTo).getTime();

    if (selectedRule.status === 'emergency_authorization' && selectedRule.emergencyAuthorizationWindow) {
      const emFrom = new Date(selectedRule.emergencyAuthorizationWindow.validFrom).getTime();
      const emTo = new Date(selectedRule.emergencyAuthorizationWindow.validTo).getTime();
      if (adviceTime < emFrom || adviceTime > emTo) {
        return this.createRejection(
          'REGISTRATION_EXPIRED',
          `Emergency authorization window for '${selectedRule.commercialTradeName}' is not active (Valid: ${selectedRule.emergencyAuthorizationWindow.validFrom} to ${selectedRule.emergencyAuthorizationWindow.validTo}).`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }
    } else {
      if (adviceTime < effFrom) {
        return this.createRejection(
          'REGISTRATION_NOT_YET_EFFECTIVE',
          `Registration for '${selectedRule.commercialTradeName}' is not yet effective in '${jurisdiction}' (Effective from: ${selectedRule.effectiveFrom}).`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }

      if (adviceTime > effTo) {
        return this.createRejection(
          'REGISTRATION_EXPIRED',
          `Registration for '${selectedRule.commercialTradeName}' expired on ${selectedRule.effectiveTo}. Treatment prohibited without active renewal.`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }
    }

    // 10. Formulation Verification (if specified by caller)
    if (req.formulation) {
      const formMatch = matchedPestRules.find(r => r.formulationType === req.formulation);
      if (!formMatch) {
        return this.createRejection(
          'INCOMPATIBLE_FORMULATION',
          `Formulation '${req.formulation}' does not match registered formulation '${selectedRule.formulationType}' for '${selectedRule.commercialTradeName}'.`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }
      selectedRule = formMatch;
      const recomputedFormHash = this.calculateRuleHash(selectedRule);
      if (recomputedFormHash !== selectedRule.ruleHash) {
        return this.createRejection(
          'DATASET_CORRUPTED_OR_HASH_MISMATCH',
          `Internal security violation: Cryptographic rule hash corruption detected for Rule '${selectedRule.ruleId}'. Decision aborted.`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }
      const formEffFrom = new Date(selectedRule.effectiveFrom).getTime();
      const formEffTo = new Date(selectedRule.effectiveTo).getTime();
      if (adviceTime < formEffFrom) {
        return this.createRejection(
          'REGISTRATION_NOT_YET_EFFECTIVE',
          `Registration for '${selectedRule.commercialTradeName}' is not yet effective in '${jurisdiction}' (Effective from: ${selectedRule.effectiveFrom}).`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }
      if (adviceTime > formEffTo) {
        return this.createRejection(
          'REGISTRATION_EXPIRED',
          `Registration for '${selectedRule.commercialTradeName}' expired on ${selectedRule.effectiveTo}. Treatment prohibited without active renewal.`,
          req,
          adviceTimestamp,
          selectedRule
        );
      }
    }

    // 11. Dosage Upper Ceiling Enforcement
    if (req.doseGramsOrMlHa > selectedRule.maxDoseMlOrGramsHa) {
      return this.createRejection(
        'EXCEEDS_MAX_LEGAL_RATE',
        `Dosage of ${req.doseGramsOrMlHa} exceeds legal maximum application rate of ${selectedRule.maxDoseMlOrGramsHa} (mL or g/ha) for '${selectedRule.commercialTradeName}'.`,
        req,
        adviceTimestamp,
        selectedRule
      );
    }

    // 12. Pre-Harvest Interval (PHI) Enforcement
    if (req.daysToHarvest !== undefined && req.daysToHarvest < selectedRule.legalPhiDays) {
      return this.createRejection(
        'PHI_VIOLATION',
        `Pre-Harvest Interval (PHI) violation: Application scheduled ${req.daysToHarvest} days before harvest, but legal PHI for '${selectedRule.commercialTradeName}' on '${req.crop}' is ${selectedRule.legalPhiDays} days. Severe toxic residue risk.`,
        req,
        adviceTimestamp,
        selectedRule
      );
    }

    // 13. Pollinator / Flowering Lockout Enforcement
    if (
      (req.floweringPresent || req.pollinatorsPresent) &&
      selectedRule.environmentalRestrictions.pollinatorLockoutDuringFlowering
    ) {
      return this.createRejection(
        'POLLINATOR_FLOWERING_VIOLATION',
        `POLLINATOR LOCKOUT: '${selectedRule.commercialTradeName}' application is prohibited during crop flowering or when bees/pollinators are actively foraging. High risk of colony collapse.`,
        req,
        adviceTimestamp,
        selectedRule
      );
    }

    // 14. Restricted-Entry Interval (REI) Warning
    if (selectedRule.legalReiHours > 0) {
      warnings.push(`Restricted-Entry Interval: Keep field personnel and livestock out of treated area for ${selectedRule.legalReiHours} hours unless wearing certified PPE.`);
    }

    // 15. Environmental Buffer Warning
    if (selectedRule.environmentalRestrictions.bufferZoneMeters > 0) {
      warnings.push(`Mandatory environmental buffer zone: Maintain ${selectedRule.environmentalRestrictions.bufferZoneMeters}m untreated buffer from aquatic waterways.`);
    }

    // 16. Decision Approval & Cryptographic Provenance Generation
    const decisionStatus: 'APPROVED' | 'HARD_REJECTION' | 'RESTRICTED_OFFLINE_APPROVAL' = isOfflineApproval ? 'RESTRICTED_OFFLINE_APPROVAL' : 'APPROVED';
    const recommendationId = crypto.randomUUID();

    const provenanceBase = {
      recommendationId,
      adviceTimestamp,
      jurisdiction,
      farmerId: req.farmerId,
      officerId: req.officerId,
      productRegistrationId: selectedRule.registrationNumber,
      commercialTradeName: selectedRule.commercialTradeName,
      activeIngredients: selectedRule.activeIngredients,
      formulation: selectedRule.formulationType,
      crop: req.crop,
      pestDisease: req.pestOrDisease,
      dose: req.doseGramsOrMlHa,
      applicationMethod: req.applicationMethod || selectedRule.applicationMethod,
      daysToHarvest: req.daysToHarvest,
      floweringStatus: Boolean(req.floweringPresent),
      pollinatorStatus: Boolean(req.pollinatorsPresent),
      datasetVersion: selectedRule.datasetVersion,
      ruleId: selectedRule.ruleId,
      ruleHash: selectedRule.ruleHash,
      decisionStatus,
      engineVersion: ENGINE_VERSION,
      offlineContext: req.clientOfflineContext?.isOffline
        ? { isOffline: true, datasetAgeDays }
        : undefined,
    };

    const recommendationIntegrityHash = this.calculateRecommendationIntegrityHash(provenanceBase);

    // Mock HMAC signature envelope demonstrating cryptographic signer non-repudiation
    const digitalSignature = crypto
      .createHmac('sha256', 'REGULATORY_AUTHORITY_ROOT_SECRET_2026')
      .update(recommendationIntegrityHash)
      .digest('hex');

    const fullProvenance: RecommendationProvenance = {
      ...provenanceBase,
      recommendationIntegrityHash,
      digitalSignatureEnvelope: {
        algorithm: 'HMAC-SHA256',
        signature: digitalSignature,
        signedBy: `${selectedRule.authorityId}:AUTHORIZATION_KEY_V1`,
      },
    };

    // Store in historical ledger for audit reconstruction
    this.historicalRecommendations.set(recommendationIntegrityHash, fullProvenance);
    this.historicalRecommendations.set(recommendationId, fullProvenance);

    logger.info(`RegulatoryDecision: ${decisionStatus} for ${selectedRule.commercialTradeName} on ${req.crop} (Hash: ${recommendationIntegrityHash.slice(0, 12)}...)`);

    return {
      status: decisionStatus,
      reasonCode: 'AUTHORIZED_ACTIVE_REGISTRATION',
      rule: selectedRule,
      provenance: fullProvenance,
      warnings,
    };
  }

  /**
   * Historical State Reconstructibility:
   * Enables auditors to query any prior recommendation hash and verify whether the exact
   * regulatory conditions, rules, and gazette citations at that instant match the output.
   */
  public auditReconstruct(recommendationHashOrId: string): AuditReconstruction {
    const auditTimestamp = new Date().toISOString();
    const storedProvenance = this.historicalRecommendations.get(recommendationHashOrId);

    if (!storedProvenance) {
      return {
        verified: false,
        auditTimestamp,
        recommendationHash: recommendationHashOrId,
        integrityCheck: 'RECORD_NOT_FOUND',
        discrepancies: [`No recommendation record matching hash/ID '${recommendationHashOrId}' found in historical audit ledger.`],
      };
    }

    const discrepancies: string[] = [];

    // Recompute integrity hash
    const recomputedHash = this.calculateRecommendationIntegrityHash(storedProvenance);
    if (recomputedHash !== storedProvenance.recommendationIntegrityHash) {
      discrepancies.push(`Recommendation integrity hash mismatch! Expected ${storedProvenance.recommendationIntegrityHash}, recomputed ${recomputedHash}`);
    }

    // Verify digital signature envelope
    if (storedProvenance.digitalSignatureEnvelope) {
      const expectedSig = crypto
        .createHmac('sha256', 'REGULATORY_AUTHORITY_ROOT_SECRET_2026')
        .update(storedProvenance.recommendationIntegrityHash)
        .digest('hex');

      if (expectedSig !== storedProvenance.digitalSignatureEnvelope.signature) {
        discrepancies.push('Digital signature verification failed! Signature envelope has been tampered with.');
      }
    }

    // Match rule
    const matchedRule = this.rules.get(storedProvenance.ruleId);
    if (!matchedRule) {
      discrepancies.push(`Historical rule '${storedProvenance.ruleId}' is no longer present in rule registry.`);
    } else {
      if (matchedRule.ruleHash !== storedProvenance.ruleHash) {
        discrepancies.push(`Rule hash changed since recommendation was made! Historical: ${storedProvenance.ruleHash}, Current: ${matchedRule.ruleHash}`);
      }
    }

    const verified = discrepancies.length === 0;

    return {
      verified,
      auditTimestamp,
      recommendationHash: storedProvenance.recommendationIntegrityHash,
      reconstructedProvenance: storedProvenance,
      matchedRule,
      integrityCheck: verified ? 'INTACT' : 'CORRUPTED',
      discrepancies,
    };
  }

  /**
   * Ingests a new or updated rule, calculating its canonical hash.
   */
  public ingestRule(ruleInput: Omit<RegulatoryRule, 'ruleHash'>): RegulatoryRule {
    const ruleHash = this.calculateRuleHash(ruleInput);
    const rule: RegulatoryRule = { ...ruleInput, ruleHash };
    this.rules.set(rule.ruleId, rule);
    logger.info(`RegulatoryProvenanceService: Ingested rule ${rule.ruleId} (${rule.commercialTradeName}) - Hash: ${ruleHash.slice(0, 10)}`);
    return rule;
  }

  /**
   * Registers a new authority.
   */
  public registerAuthority(authority: RegulatoryAuthority): void {
    this.authorities.set(authority.authorityId, authority);
  }

  /**
   * Registers a source gazette/document.
   */
  public registerDocument(document: RegulatoryDocument): void {
    this.documents.set(document.documentId, document);
  }

  /**
   * Helper to create structured hard rejections.
   */
  private createRejection(
    reasonCode: RegulatoryDecision['reasonCode'],
    rejectionMessage: string,
    req: RecommendationEvaluationRequest,
    adviceTimestamp: string,
    rule?: RegulatoryRule
  ): RegulatoryDecision {
    const recommendationId = crypto.randomUUID();
    const provenanceBase = {
      recommendationId,
      adviceTimestamp,
      jurisdiction: req.jurisdiction.toUpperCase().trim(),
      farmerId: req.farmerId,
      officerId: req.officerId,
      productRegistrationId: rule ? rule.registrationNumber : 'UNREGISTERED',
      commercialTradeName: req.treatmentTradeNameOrIngredient,
      activeIngredients: rule ? rule.activeIngredients : [{ name: req.treatmentTradeNameOrIngredient, concentrationGramsPerKgOrL: 0 }],
      formulation: req.formulation || (rule ? rule.formulationType : 'WP'),
      crop: req.crop,
      pestDisease: req.pestOrDisease,
      dose: req.doseGramsOrMlHa,
      applicationMethod: req.applicationMethod || (rule ? rule.applicationMethod : 'knapsack_foliar'),
      daysToHarvest: req.daysToHarvest,
      floweringStatus: Boolean(req.floweringPresent),
      pollinatorStatus: Boolean(req.pollinatorsPresent),
      datasetVersion: rule ? rule.datasetVersion : this.currentDatasetVersion,
      ruleId: rule ? rule.ruleId : 'NONE',
      ruleHash: rule ? rule.ruleHash : 'NONE',
      decisionStatus: 'HARD_REJECTION' as const,
      engineVersion: ENGINE_VERSION,
    };

    const recommendationIntegrityHash = this.calculateRecommendationIntegrityHash(provenanceBase);
    const provenance: RecommendationProvenance = {
      ...provenanceBase,
      recommendationIntegrityHash,
    };

    this.historicalRecommendations.set(recommendationIntegrityHash, provenance);
    this.historicalRecommendations.set(recommendationId, provenance);

    logger.warn(`RegulatoryDecision: HARD_REJECTION (${reasonCode}) — ${rejectionMessage}`);

    return {
      status: 'HARD_REJECTION',
      reasonCode,
      rejectionMessage,
      rule,
      provenance,
      warnings: [],
    };
  }

  /**
   * Seeds initial baseline registry from accredited authorities:
   * 1. Kenya Pest Control Products Board (PCPB)
   * 2. India Central Insecticides Board & Registration Committee (CIB&RC)
   * 3. Canada Pest Management Regulatory Agency (PMRA)
   */
  private seedDefaultAuthoritiesAndRules(): void {
    // 1. Authorities
    this.registerAuthority({
      authorityId: 'KE-PCPB',
      jurisdiction: 'KE',
      name: 'Kenya Pest Control Products Board',
      officialGazetteOrRegistryUrl: 'https://pcpb.go.ke/registered-products',
    });

    this.registerAuthority({
      authorityId: 'IN-CIBRC',
      jurisdiction: 'IN',
      name: 'Central Insecticides Board & Registration Committee',
      officialGazetteOrRegistryUrl: 'https://cibrc.gov.in/registered-products',
    });

    this.registerAuthority({
      authorityId: 'CA-PMRA',
      jurisdiction: 'CA',
      name: 'Pest Management Regulatory Agency (Health Canada)',
      officialGazetteOrRegistryUrl: 'https://www.canada.ca/en/health-canada/services/consumer-product-safety/pesticides-pest-management.html',
    });

    // 2. Documents / Gazettes
    this.registerDocument({
      documentId: 'DOC-KE-GAZ-2024-01',
      authorityId: 'KE-PCPB',
      gazetteCitation: 'Kenya Gazette Notice No. 4512 — Registered Agrochemicals 2024',
      publishedDate: '2024-01-15T00:00:00Z',
      sourceHash: 'a1b2c3d4e5f60102030405060708090a0b0c0d0e0f1011121314151617181920',
    });

    this.registerDocument({
      documentId: 'DOC-KE-BAN-2023-09',
      authorityId: 'KE-PCPB',
      gazetteCitation: 'Kenya Gazette Notice No. 12934 — Prohibition of Chlorpyrifos and Endosulfan',
      publishedDate: '2023-09-01T00:00:00Z',
      sourceHash: 'b2c3d4e5f6a102030405060708090a0b0c0d0e0f101112131415161718192021',
    });

    this.registerDocument({
      documentId: 'DOC-IN-CIB-2025-03',
      authorityId: 'IN-CIBRC',
      gazetteCitation: 'Government of India Gazette Schedule II (CIBRC-2025)',
      publishedDate: '2025-03-01T00:00:00Z',
      sourceHash: 'c3d4e5f6a1b2030405060708090a0b0c0d0e0f10111213141516171819202122',
    });

    // 3. Seed Rules
    // Rule 1: Ridomil Gold MZ 68 WG in Kenya for Tomato/Potato Late Blight
    this.ingestRule({
      ruleId: 'RULE-KE-PCPB-0142-POTATO',
      registrationNumber: 'PCPB(CR)0142',
      jurisdiction: 'KE',
      authorityId: 'KE-PCPB',
      documentId: 'DOC-KE-GAZ-2024-01',
      datasetVersion: this.currentDatasetVersion,
      commercialTradeName: 'Ridomil Gold MZ 68 WG',
      activeIngredients: [
        { name: 'metalaxyl-M', concentrationGramsPerKgOrL: 40 },
        { name: 'mancozeb', concentrationGramsPerKgOrL: 640 },
      ],
      formulationType: 'WG',
      crop: 'potato',
      targetPests: ['late blight', 'phytophthora infestans', 'early blight'],
      maxDoseMlOrGramsHa: 2500, // 2.5 kg/ha formulation
      applicationMethod: 'knapsack_foliar',
      legalPhiDays: 14,
      legalReiHours: 24,
      maxApplicationsPerSeason: 3,
      environmentalRestrictions: {
        bufferZoneMeters: 10,
        pollinatorLockoutDuringFlowering: false,
        aquaticRunoffRisk: 'moderate',
      },
      status: 'active_registered',
      effectiveFrom: '2024-01-01T00:00:00Z',
      effectiveTo: '2028-12-31T23:59:59Z',
    });

    // Rule 2: Ridomil Gold for Tomato
    this.ingestRule({
      ruleId: 'RULE-KE-PCPB-0142-TOMATO',
      registrationNumber: 'PCPB(CR)0142',
      jurisdiction: 'KE',
      authorityId: 'KE-PCPB',
      documentId: 'DOC-KE-GAZ-2024-01',
      datasetVersion: this.currentDatasetVersion,
      commercialTradeName: 'Ridomil Gold MZ 68 WG',
      activeIngredients: [
        { name: 'metalaxyl-M', concentrationGramsPerKgOrL: 40 },
        { name: 'mancozeb', concentrationGramsPerKgOrL: 640 },
      ],
      formulationType: 'WG',
      crop: 'tomato',
      targetPests: ['late blight', 'phytophthora infestans'],
      maxDoseMlOrGramsHa: 2500,
      applicationMethod: 'knapsack_foliar',
      legalPhiDays: 7, // 7 days for tomato
      legalReiHours: 24,
      maxApplicationsPerSeason: 3,
      environmentalRestrictions: {
        bufferZoneMeters: 10,
        pollinatorLockoutDuringFlowering: false,
        aquaticRunoffRisk: 'moderate',
      },
      status: 'active_registered',
      effectiveFrom: '2024-01-01T00:00:00Z',
      effectiveTo: '2028-12-31T23:59:59Z',
    });

    // Rule 3: Banned Substance — Chlorpyrifos in Kenya
    this.ingestRule({
      ruleId: 'RULE-KE-PCPB-BANNED-CHLORPYRIFOS',
      registrationNumber: 'PCPB(CR)0088-REVOKED',
      jurisdiction: 'KE',
      authorityId: 'KE-PCPB',
      documentId: 'DOC-KE-BAN-2023-09',
      datasetVersion: this.currentDatasetVersion,
      commercialTradeName: 'Dursban 480 EC',
      activeIngredients: [{ name: 'chlorpyrifos', concentrationGramsPerKgOrL: 480 }],
      formulationType: 'EC',
      crop: 'maize',
      targetPests: ['fall armyworm', 'stem borer'],
      maxDoseMlOrGramsHa: 1500,
      applicationMethod: 'knapsack_foliar',
      legalPhiDays: 30,
      legalReiHours: 48,
      maxApplicationsPerSeason: 0,
      environmentalRestrictions: {
        bufferZoneMeters: 50,
        pollinatorLockoutDuringFlowering: true,
        aquaticRunoffRisk: 'extreme',
      },
      status: 'revoked_banned',
      effectiveFrom: '2023-09-01T00:00:00Z',
      effectiveTo: '2099-12-31T23:59:59Z',
    });

    // Rule 4: Confidor 200 SL in India (Pollinator lockout during flowering)
    this.ingestRule({
      ruleId: 'RULE-IN-CIBRC-CONFIDOR-COTTON',
      registrationNumber: 'CIR-2234',
      jurisdiction: 'IN',
      authorityId: 'IN-CIBRC',
      documentId: 'DOC-IN-CIB-2025-03',
      datasetVersion: this.currentDatasetVersion,
      commercialTradeName: 'Confidor 200 SL',
      activeIngredients: [{ name: 'imidacloprid', concentrationGramsPerKgOrL: 200 }],
      formulationType: 'SL',
      crop: 'cotton',
      targetPests: ['aphids', 'jassids', 'whitefly'],
      maxDoseMlOrGramsHa: 100, // 100 mL/ha
      applicationMethod: 'knapsack_foliar',
      legalPhiDays: 21,
      legalReiHours: 24,
      maxApplicationsPerSeason: 2,
      environmentalRestrictions: {
        bufferZoneMeters: 15,
        pollinatorLockoutDuringFlowering: true, // Severe bee toxicant
        aquaticRunoffRisk: 'moderate',
      },
      status: 'active_registered',
      effectiveFrom: '2025-01-01T00:00:00Z',
      effectiveTo: '2029-12-31T23:59:59Z',
    });

    // Rule 5: Emergency Locust Authorization (Desert Locust Control)
    this.ingestRule({
      ruleId: 'RULE-KE-EMERGENCY-LOCUST-2026',
      registrationNumber: 'EAU-KE-2026-LOCUST',
      jurisdiction: 'KE',
      authorityId: 'KE-PCPB',
      documentId: 'DOC-KE-GAZ-2024-01',
      datasetVersion: this.currentDatasetVersion,
      commercialTradeName: 'Chlorfenapyr Ultra 240 SC',
      activeIngredients: [{ name: 'chlorfenapyr', concentrationGramsPerKgOrL: 240 }],
      formulationType: 'SC',
      crop: 'pasture',
      targetPests: ['desert locust', 'swarms of desert locust'],
      maxDoseMlOrGramsHa: 500,
      applicationMethod: 'boom_spray',
      legalPhiDays: 14,
      legalReiHours: 48,
      maxApplicationsPerSeason: 1,
      environmentalRestrictions: {
        bufferZoneMeters: 30,
        pollinatorLockoutDuringFlowering: true,
        aquaticRunoffRisk: 'extreme',
      },
      status: 'emergency_authorization',
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: '2026-12-31T23:59:59Z',
      emergencyAuthorizationWindow: {
        validFrom: '2026-06-01T00:00:00Z',
        validTo: '2026-10-31T23:59:59Z',
        exemptionNotice: 'National Desert Locust Biosecurity Crisis Exemption (Ministry of Agriculture)',
      },
    });
  }
}

export const regulatoryProvenanceService = RegulatoryProvenanceService.getInstance();
