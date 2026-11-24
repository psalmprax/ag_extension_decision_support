import type { RegulatoryProvenanceService } from '@/services/regulatoryProvenanceService';

/**
 * Test-only regulatory data under fictional jurisdictions ZZ and YY, with fictional products,
 * registrations and notices. It exercises the engine's rules (rates, intervals, bans, pollinator
 * lockouts, emergency windows); none of it describes a real registration.
 */
export function loadRegulatoryTestFixtures(service: RegulatoryProvenanceService): void {
  service.registerAuthority({
    authorityId: 'ZZ-TEST',
    jurisdiction: 'ZZ',
    name: 'Test registration authority (fixture)',
    officialGazetteOrRegistryUrl: 'https://example.org/test-registry',
  });
  service.registerAuthority({
    authorityId: 'YY-TEST',
    jurisdiction: 'YY',
    name: 'Second test authority (fixture)',
    officialGazetteOrRegistryUrl: 'https://example.org/test-registry-2',
  });
  // Documents
  service.registerDocument({
    documentId: 'DOC-ZZ-GAZ-2024-01',
    authorityId: 'ZZ-TEST',
    gazetteCitation: 'Test register of products (fixture)',
    publishedDate: '2024-01-15T00:00:00Z',
    sourceHash: 'a1b2c3d4e5f60102030405060708090a0b0c0d0e0f1011121314151617181920',
  });

  service.registerDocument({
    documentId: 'DOC-ZZ-BAN-2023-09',
    authorityId: 'ZZ-TEST',
    gazetteCitation: 'Test prohibition notice (fixture)',
    publishedDate: '2023-09-01T00:00:00Z',
    sourceHash: 'b2c3d4e5f6a102030405060708090a0b0c0d0e0f101112131415161718192021',
  });

  service.registerDocument({
    documentId: 'DOC-YY-CIB-2025-03',
    authorityId: 'YY-TEST',
    gazetteCitation: 'Test schedule (fixture)',
    publishedDate: '2025-03-01T00:00:00Z',
    sourceHash: 'c3d4e5f6a1b2030405060708090a0b0c0d0e0f10111213141516171819202122',
  });

  // 3. Seed Rules
  // Rule 1: a registered fungicide for potato late blight
  service.ingestRule({
    ruleId: 'RULE-ZZ-PCPB-0142-POTATO',
    registrationNumber: 'TEST-0142',
    jurisdiction: 'ZZ',
    authorityId: 'ZZ-TEST',
    documentId: 'DOC-ZZ-GAZ-2024-01',
    datasetVersion: service.datasetVersion,
    commercialTradeName: 'Example Fungicide 68 WG',
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

  // Rule 2: Same product for tomato
  service.ingestRule({
    ruleId: 'RULE-ZZ-PCPB-0142-TOMATO',
    registrationNumber: 'TEST-0142',
    jurisdiction: 'ZZ',
    authorityId: 'ZZ-TEST',
    documentId: 'DOC-ZZ-GAZ-2024-01',
    datasetVersion: service.datasetVersion,
    commercialTradeName: 'Example Fungicide 68 WG',
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

  // Rule 3: Banned substance
  service.ingestRule({
    ruleId: 'RULE-ZZ-PCPB-BANNED-CHLORPYRIFOS',
    registrationNumber: 'TEST-0088-REVOKED',
    jurisdiction: 'ZZ',
    authorityId: 'ZZ-TEST',
    documentId: 'DOC-ZZ-BAN-2023-09',
    datasetVersion: service.datasetVersion,
    commercialTradeName: 'Example Banned 480 EC',
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

  // Rule 4: an insecticide with a pollinator lockout during flowering
  service.ingestRule({
    ruleId: 'RULE-YY-CIBRC-CONFIDOR-COTTON',
    registrationNumber: 'TEST-2234',
    jurisdiction: 'YY',
    authorityId: 'YY-TEST',
    documentId: 'DOC-YY-CIB-2025-03',
    datasetVersion: service.datasetVersion,
    commercialTradeName: 'Example Insecticide 200 SL',
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
  service.ingestRule({
    ruleId: 'RULE-ZZ-EMERGENCY-LOCUST-2026',
    registrationNumber: 'TEST-EAU-2026',
    jurisdiction: 'ZZ',
    authorityId: 'ZZ-TEST',
    documentId: 'DOC-ZZ-GAZ-2024-01',
    datasetVersion: service.datasetVersion,
    commercialTradeName: 'Example Emergency 240 SC',
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
      exemptionNotice: 'Test emergency exemption (fixture)',
    },
  });
}
