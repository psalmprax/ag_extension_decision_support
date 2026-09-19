import {
  regulatoryProvenanceService,
  RegulatoryRule,
} from '@/services/regulatoryProvenanceService';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

describe('AD-001: Regulatory Knowledge & Rule Provenance Subsystem', () => {
  const BASELINE_TIMESTAMP = '2026-08-15T10:00:00Z';

  // Helper for standard compliant request in Kenya
  const createCompliantRequest = (overrides = {}) => ({
    jurisdiction: 'KE',
    crop: 'potato',
    pestOrDisease: 'late blight',
    treatmentTradeNameOrIngredient: 'Ridomil Gold MZ 68 WG',
    formulation: 'WG' as const,
    doseGramsOrMlHa: 2000, // Legal max is 2500
    applicationMethod: 'knapsack_foliar' as const,
    daysToHarvest: 21, // Legal PHI is 14
    floweringPresent: false,
    pollinatorsPresent: false,
    adviceTimestamp: BASELINE_TIMESTAMP,
    farmerId: 'FARMER-KE-001',
    officerId: 'OFFICER-KE-042',
    ...overrides,
  });

  describe('1. Authoritative Regulatory Decisioning (Invariants 1–12)', () => {
    it.each([
      [{ jurisdiction: 'UNKNOWN', clientOfflineContext: { isOffline: true, cachedDatasetVersion: 'old', cachedDatasetTimestamp: 'invalid' } }, 'OFFLINE_DATASET_STALE_EXPIRED'],
      [{ treatmentTradeNameOrIngredient: 'Dursban 480 EC', crop: 'unregistered' }, 'REGISTRATION_REVOKED_BANNED'],
      [{ crop: 'unregistered', pestOrDisease: 'unregistered' }, 'UNREGISTERED_CROP'],
      [{ adviceTimestamp: '2099-01-01T00:00:00Z', formulation: 'EC' }, 'REGISTRATION_EXPIRED'],
      [{ doseGramsOrMlHa: 99999, daysToHarvest: 0, floweringPresent: true }, 'EXCEEDS_MAX_LEGAL_RATE'],
      [{ daysToHarvest: 0, floweringPresent: true }, 'PHI_VIOLATION'],
    ])('preserves rejection precedence for %j', (overrides, reasonCode) => {
      const decision = regulatoryProvenanceService.evaluateRecommendation(createCompliantRequest(overrides));
      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe(reasonCode);
    });

    it('1. Valid active registration -> APPROVE with cryptographic provenance', () => {
      const req = createCompliantRequest();
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('APPROVED');
      expect(decision.reasonCode).toBe('AUTHORIZED_ACTIVE_REGISTRATION');
      expect(decision.rule?.registrationNumber).toBe('PCPB(CR)0142');
      expect(decision.provenance).toBeDefined();
      expect(decision.provenance?.recommendationIntegrityHash).toBeDefined();
      expect(decision.provenance?.digitalSignatureEnvelope?.signature).toBeDefined();
    });

    it('2. Unknown product -> HARD REJECTION (UNREGISTERED_PRODUCT)', () => {
      const req = createCompliantRequest({
        treatmentTradeNameOrIngredient: 'Magic Miracle Potion 9000',
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('UNREGISTERED_PRODUCT');
      expect(decision.rejectionMessage).toContain('strictly rejected');
    });

    it('3. Unregistered crop -> HARD REJECTION (UNREGISTERED_CROP)', () => {
      const req = createCompliantRequest({
        crop: 'vanilla_orchid', // Not registered for Ridomil Gold
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('UNREGISTERED_CROP');
      expect(decision.rejectionMessage).toContain('Off-label application blocked');
    });

    it('4. Unregistered pest/use -> HARD REJECTION (UNREGISTERED_PEST_OR_USE)', () => {
      const req = createCompliantRequest({
        pestOrDisease: 'spider_mite_invasion', // Ridomil is an oomycete fungicide, not an acaricide
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('UNREGISTERED_PEST_OR_USE');
      expect(decision.rejectionMessage).toContain('NOT approved for target pest/disease');
    });

    it('5. Wrong formulation -> HARD REJECTION (INCOMPATIBLE_FORMULATION)', () => {
      const req = createCompliantRequest({
        formulation: 'EC', // Registered as WG (water-dispersible granule)
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('INCOMPATIBLE_FORMULATION');
      expect(decision.rejectionMessage).toContain('does not match registered formulation');
    });

    it('6. Rate above legal maximum -> HARD REJECTION (EXCEEDS_MAX_LEGAL_RATE)', () => {
      const req = createCompliantRequest({
        doseGramsOrMlHa: 3500, // Max legal is 2500 g/ha
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('EXCEEDS_MAX_LEGAL_RATE');
      expect(decision.rejectionMessage).toContain('exceeds legal maximum application rate of 2500');
    });

    it('7. PHI violation -> HARD REJECTION (PHI_VIOLATION)', () => {
      const req = createCompliantRequest({
        daysToHarvest: 5, // Legal PHI is 14 days
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('PHI_VIOLATION');
      expect(decision.rejectionMessage).toContain('Pre-Harvest Interval (PHI) violation');
      expect(decision.rejectionMessage).toContain('legal PHI for \'Ridomil Gold MZ 68 WG\' on \'potato\' is 14 days');
    });

    it('8. REI violation warning -> Attached to approved decision', () => {
      const req = createCompliantRequest();
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('APPROVED');
      expect(decision.warnings.some(w => w.includes('Restricted-Entry Interval') && w.includes('24 hours'))).toBe(true);
    });

    it('9. Flowering / pollinator restriction -> HARD REJECTION (POLLINATOR_FLOWERING_VIOLATION)', () => {
      // Confidor 200 SL in India has pollinatorLockoutDuringFlowering = true
      const req = {
        jurisdiction: 'IN',
        crop: 'cotton',
        pestOrDisease: 'jassids',
        treatmentTradeNameOrIngredient: 'Confidor 200 SL',
        formulation: 'SL' as const,
        doseGramsOrMlHa: 80,
        applicationMethod: 'knapsack_foliar' as const,
        daysToHarvest: 30,
        floweringPresent: true, // Crop is blooming
        pollinatorsPresent: true,
        adviceTimestamp: BASELINE_TIMESTAMP,
        farmerId: 'FARMER-IN-99',
        officerId: 'OFFICER-IN-12',
      };
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('POLLINATOR_FLOWERING_VIOLATION');
      expect(decision.rejectionMessage).toContain('POLLINATOR LOCKOUT');
    });

    it('10. Expired registration -> HARD REJECTION (REGISTRATION_EXPIRED)', () => {
      const req = createCompliantRequest({
        adviceTimestamp: '2030-01-01T00:00:00Z', // Ridomil registration expires 2028-12-31
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('REGISTRATION_EXPIRED');
      expect(decision.rejectionMessage).toContain('expired on 2028-12-31');
    });

    it('11. Future registration -> HARD REJECTION (REGISTRATION_NOT_YET_EFFECTIVE)', () => {
      // Ingest a futuristic rule
      regulatoryProvenanceService.ingestRule({
        ruleId: 'RULE-KE-FUTURE-BIO',
        registrationNumber: 'PCPB(CR)9999',
        jurisdiction: 'KE',
        authorityId: 'KE-PCPB',
        documentId: 'DOC-KE-GAZ-2024-01',
        datasetVersion: 'REG-2026.09-REV1',
        commercialTradeName: 'BioFuture Fungicide 500 SC',
        activeIngredients: [{ name: 'bacillus_subtilis_q3', concentrationGramsPerKgOrL: 500 }],
        formulationType: 'SC',
        crop: 'potato',
        targetPests: ['late blight'],
        maxDoseMlOrGramsHa: 1000,
        applicationMethod: 'knapsack_foliar',
        legalPhiDays: 1,
        legalReiHours: 4,
        maxApplicationsPerSeason: 5,
        environmentalRestrictions: {
          bufferZoneMeters: 5,
          pollinatorLockoutDuringFlowering: false,
          aquaticRunoffRisk: 'low',
        },
        status: 'active_registered',
        effectiveFrom: '2028-01-01T00:00:00Z', // Effective in 2028
        effectiveTo: '2035-12-31T23:59:59Z',
      });

      const req = createCompliantRequest({
        treatmentTradeNameOrIngredient: 'BioFuture Fungicide 500 SC',
        formulation: 'SC',
        adviceTimestamp: '2026-08-15T10:00:00Z',
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('REGISTRATION_NOT_YET_EFFECTIVE');
    });

    it('12. Revoked / banned registration -> HARD REJECTION (REGISTRATION_REVOKED_BANNED)', () => {
      // Chlorpyrifos (Dursban 480 EC) was banned in Kenya
      const req = {
        jurisdiction: 'KE',
        crop: 'maize',
        pestOrDisease: 'fall armyworm',
        treatmentTradeNameOrIngredient: 'Dursban 480 EC',
        formulation: 'EC' as const,
        doseGramsOrMlHa: 1000,
        adviceTimestamp: BASELINE_TIMESTAMP,
        farmerId: 'FARMER-KE-002',
        officerId: 'OFFICER-KE-042',
      };
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('REGISTRATION_REVOKED_BANNED');
      expect(decision.rejectionMessage).toContain('PROHIBITED SUBSTANCE');
      expect(decision.rejectionMessage).toContain('Kenya Gazette Notice No. 12934');
    });
  });

  describe('2. Cryptographic Provenance, Reconstructibility & Adversarial Integrity (Invariants 13–24)', () => {
    it('13. Historical recommendation reconstruction -> Exact rule and state recovered', () => {
      const req = createCompliantRequest();
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);
      const hash = decision.provenance!.recommendationIntegrityHash;

      const reconstruction = regulatoryProvenanceService.auditReconstruct(hash);
      expect(reconstruction.verified).toBe(true);
      expect(reconstruction.integrityCheck).toBe('INTACT');
      expect(reconstruction.matchedRule?.registrationNumber).toBe('PCPB(CR)0142');
      expect(reconstruction.reconstructedProvenance?.dose).toBe(2000);
      expect(reconstruction.discrepancies.length).toBe(0);
    });

    it('14. Dataset corruption / rule hash mismatch -> REJECT safely', () => {
      // Create a corrupted rule where stored hash does not match computed payload
      const corruptedRule: RegulatoryRule = {
        ruleId: 'RULE-KE-CORRUPTED-001',
        registrationNumber: 'PCPB(CR)7777',
        jurisdiction: 'KE',
        authorityId: 'KE-PCPB',
        documentId: 'DOC-KE-GAZ-2024-01',
        datasetVersion: 'REG-2026.09-REV1',
        commercialTradeName: 'Compromised Spray 100 WP',
        activeIngredients: [{ name: 'copper_oxychloride', concentrationGramsPerKgOrL: 500 }],
        formulationType: 'WP',
        crop: 'tomato',
        targetPests: ['early blight'],
        maxDoseMlOrGramsHa: 2000,
        applicationMethod: 'knapsack_foliar',
        legalPhiDays: 7,
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
        ruleHash: '0000000000000000000000000000000000000000000000000000000000000000', // Forged/corrupt hash
      };

      // Force insert into private rules map for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (regulatoryProvenanceService as any).rules.set(corruptedRule.ruleId, corruptedRule);

      const req = createCompliantRequest({
        treatmentTradeNameOrIngredient: 'Compromised Spray 100 WP',
        formulation: 'WP',
        crop: 'tomato',
        pestOrDisease: 'early blight',
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('DATASET_CORRUPTED_OR_HASH_MISMATCH');
    });

    it('15. Missing regulatory source / authority -> REJECT (MISSING_REGULATORY_SOURCE)', () => {
      const req = createCompliantRequest({
        jurisdiction: 'XX_UNKNOWN_COUNTRY',
      });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);

      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('MISSING_REGULATORY_SOURCE');
    });

    it('16. Non-existent hash lookup -> auditReconstruct reports RECORD_NOT_FOUND', () => {
      const reconstruction = regulatoryProvenanceService.auditReconstruct('deadbeef12345678');
      expect(reconstruction.verified).toBe(false);
      expect(reconstruction.integrityCheck).toBe('RECORD_NOT_FOUND');
    });

    it('17. Multiple crops registered -> Deterministic resolution matching intended crop', () => {
      // Ridomil Gold is registered for both potato (14 days PHI) and tomato (7 days PHI)
      const potatoReq = createCompliantRequest({ crop: 'potato', daysToHarvest: 10 });
      const potatoDecision = regulatoryProvenanceService.evaluateRecommendation(potatoReq);
      expect(potatoDecision.status).toBe('HARD_REJECTION'); // 10 < 14 days PHI

      const tomatoReq = createCompliantRequest({ crop: 'tomato', daysToHarvest: 10 });
      const tomatoDecision = regulatoryProvenanceService.evaluateRecommendation(tomatoReq);
      expect(tomatoDecision.status).toBe('APPROVED'); // 10 >= 7 days PHI
    });

    it('18. Emergency authorization -> Allowed within window, rejected outside window', () => {
      // Locust emergency authorization is valid from 2026-06-01 to 2026-10-31
      const validReq = {
        jurisdiction: 'KE',
        crop: 'pasture',
        pestOrDisease: 'desert locust',
        treatmentTradeNameOrIngredient: 'Chlorfenapyr Ultra 240 SC',
        doseGramsOrMlHa: 400,
        adviceTimestamp: '2026-07-15T12:00:00Z', // Within window
        farmerId: 'FARMER-KE-PASTURE',
        officerId: 'OFFICER-BIOSECURITY-1',
      };
      const validDecision = regulatoryProvenanceService.evaluateRecommendation(validReq);
      expect(validDecision.status).toBe('APPROVED');

      const expiredReq = {
        ...validReq,
        adviceTimestamp: '2026-11-15T12:00:00Z', // Outside window
      };
      const expiredDecision = regulatoryProvenanceService.evaluateRecommendation(expiredReq);
      expect(expiredDecision.status).toBe('HARD_REJECTION');
      expect(expiredDecision.reasonCode).toBe('REGISTRATION_EXPIRED');
    });

    it('19. Jurisdiction mismatch -> Treatment registered in India rejected in Kenya', () => {
      const req = {
        jurisdiction: 'KE', // In Kenya
        crop: 'cotton',
        pestOrDisease: 'jassids',
        treatmentTradeNameOrIngredient: 'Confidor 200 SL', // Only registered in IN dataset
        doseGramsOrMlHa: 50,
        adviceTimestamp: BASELINE_TIMESTAMP,
        farmerId: 'FARMER-KE-COTTON',
        officerId: 'OFFICER-KE-01',
      };
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);
      expect(decision.status).toBe('HARD_REJECTION');
      expect(decision.reasonCode).toBe('UNREGISTERED_PRODUCT');
    });

    it('20. Offline dataset policy: Stale > 90 days rejected, fresh offline permitted with flags', () => {
      // 1. Fresh offline (10 days old)
      const freshOfflineReq = createCompliantRequest({
        clientOfflineContext: {
          isOffline: true,
          cachedDatasetVersion: 'REG-2026.09-REV1',
          cachedDatasetTimestamp: '2026-08-05T00:00:00Z', // 10 days before advice
        },
      });
      const freshDecision = regulatoryProvenanceService.evaluateRecommendation(freshOfflineReq);
      expect(freshDecision.status).toBe('RESTRICTED_OFFLINE_APPROVAL');
      expect(freshDecision.provenance?.offlineContext?.isOffline).toBe(true);
      expect(freshDecision.warnings.some(w => w.includes('Offline regulatory dataset used'))).toBe(true);

      // 2. Excessively stale offline (120 days old)
      const staleOfflineReq = createCompliantRequest({
        clientOfflineContext: {
          isOffline: true,
          cachedDatasetVersion: 'REG-2026.09-REV1',
          cachedDatasetTimestamp: '2026-04-01T00:00:00Z', // > 90 days
        },
      });
      const staleDecision = regulatoryProvenanceService.evaluateRecommendation(staleOfflineReq);
      expect(staleDecision.status).toBe('HARD_REJECTION');
      expect(staleDecision.reasonCode).toBe('OFFLINE_DATASET_STALE_EXPIRED');
    });

    it('21. Advice timestamp integrity -> Hash incorporates precise timestamp', () => {
      const req1 = createCompliantRequest({ adviceTimestamp: '2026-08-15T10:00:00Z' });
      const req2 = createCompliantRequest({ adviceTimestamp: '2026-08-15T10:00:01Z' });

      const d1 = regulatoryProvenanceService.evaluateRecommendation(req1);
      const d2 = regulatoryProvenanceService.evaluateRecommendation(req2);

      expect(d1.provenance?.recommendationIntegrityHash).not.toBe(d2.provenance?.recommendationIntegrityHash);
    });

    it('22. Audit-log tampering detection -> auditReconstruct detects forged signature', () => {
      const req = createCompliantRequest();
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);
      const hash = decision.provenance!.recommendationIntegrityHash;

      // Tamper with the digital signature in ledger
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const record = (regulatoryProvenanceService as any).historicalRecommendations.get(hash);
      record.digitalSignatureEnvelope.signature = 'forged_signature_00000000';

      const reconstruction = regulatoryProvenanceService.auditReconstruct(hash);
      expect(reconstruction.verified).toBe(false);
      expect(reconstruction.discrepancies.some(d => d.includes('Digital signature verification failed'))).toBe(true);
    });

    it('23. Replay of old approval -> Historical reconstruction verifies original conditions', () => {
      const req = createCompliantRequest({ farmerId: 'HISTORICAL-FARMER-88' });
      const decision = regulatoryProvenanceService.evaluateRecommendation(req);
      const hash = decision.provenance!.recommendationIntegrityHash;

      // Ingest an updated rule for Ridomil Gold that changes the legal PHI to 21 days
      regulatoryProvenanceService.ingestRule({
        ruleId: 'RULE-KE-PCPB-0142-POTATO',
        registrationNumber: 'PCPB(CR)0142',
        jurisdiction: 'KE',
        authorityId: 'KE-PCPB',
        documentId: 'DOC-KE-GAZ-2024-01',
        datasetVersion: 'REG-2027.01-REV2',
        commercialTradeName: 'Ridomil Gold MZ 68 WG',
        activeIngredients: [
          { name: 'metalaxyl-M', concentrationGramsPerKgOrL: 40 },
          { name: 'mancozeb', concentrationGramsPerKgOrL: 640 },
        ],
        formulationType: 'WG',
        crop: 'potato',
        targetPests: ['late blight', 'phytophthora infestans'],
        maxDoseMlOrGramsHa: 2500,
        applicationMethod: 'knapsack_foliar',
        legalPhiDays: 21, // Changed PHI
        legalReiHours: 24,
        maxApplicationsPerSeason: 3,
        environmentalRestrictions: {
          bufferZoneMeters: 10,
          pollinatorLockoutDuringFlowering: false,
          aquaticRunoffRisk: 'moderate',
        },
        status: 'active_registered',
        effectiveFrom: '2027-01-01T00:00:00Z',
        effectiveTo: '2030-12-31T23:59:59Z',
      });

      // Historical recommendation should note that the current rule hash has evolved
      const recon = regulatoryProvenanceService.auditReconstruct(hash);
      expect(recon.reconstructedProvenance?.farmerId).toBe('HISTORICAL-FARMER-88');
      expect(recon.discrepancies.some(d => d.includes('Rule hash changed since recommendation was made'))).toBe(true);

      // Restore baseline rule so subsequent tests run against clean default state
      regulatoryProvenanceService.ingestRule({
        ruleId: 'RULE-KE-PCPB-0142-POTATO',
        registrationNumber: 'PCPB(CR)0142',
        jurisdiction: 'KE',
        authorityId: 'KE-PCPB',
        documentId: 'DOC-KE-GAZ-2024-01',
        datasetVersion: 'REG-2026.09-REV1',
        commercialTradeName: 'Ridomil Gold MZ 68 WG',
        activeIngredients: [
          { name: 'metalaxyl-M', concentrationGramsPerKgOrL: 40 },
          { name: 'mancozeb', concentrationGramsPerKgOrL: 640 },
        ],
        formulationType: 'WG',
        crop: 'potato',
        targetPests: ['late blight', 'phytophthora infestans', 'early blight'],
        maxDoseMlOrGramsHa: 2500,
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
    });

    it('24. AgronomicSafetyGuard integration -> Authoritative regulatory decision wired into safety check', () => {
      // Testing the integration through agronomicSafetyGuard.validateStructuredMetrics
      const guardResult = agronomicSafetyGuard.validateStructuredMetrics({
        jurisdiction: 'KE',
        cropType: 'potato',
        identifiedPestsOrDiseases: ['late blight'],
        pesticideName: 'Ridomil Gold MZ 68 WG',
        pesticideMlHa: 2000,
        daysToHarvest: 14,
        farmerId: 'FARMER-INTEGRATION-01',
        officerId: 'OFFICER-INTEGRATION-01',
      });

      expect(guardResult.safe).toBe(true);
      expect(guardResult.regulatoryDecision).toBeDefined();
      expect(guardResult.regulatoryDecision?.status).toBe('APPROVED');
      expect(guardResult.regulatoryDecision?.provenance).toBeDefined();

      // Negative check: Banned chemical through safety guard
      const bannedGuardResult = agronomicSafetyGuard.validateStructuredMetrics({
        jurisdiction: 'KE',
        cropType: 'maize',
        identifiedPestsOrDiseases: ['fall armyworm'],
        pesticideName: 'Dursban 480 EC',
        pesticideMlHa: 1000,
        farmerId: 'FARMER-INTEGRATION-02',
        officerId: 'OFFICER-INTEGRATION-01',
      });

      expect(bannedGuardResult.safe).toBe(false);
      expect(bannedGuardResult.hazardLevel).toBe('critical_hazard');
      expect(bannedGuardResult.violations.some(v => v.includes('PROHIBITED SUBSTANCE'))).toBe(true);
    });
  });
});
