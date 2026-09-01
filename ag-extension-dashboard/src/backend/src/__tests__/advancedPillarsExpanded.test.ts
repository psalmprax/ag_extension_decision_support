import {
  calculateNdvi,
  calculateEvi,
  calculateNdwi,
  classifyVegetationHealth,
  analyzeParcelMultispectral,
  type MultispectralPixel,
} from '../services/satelliteNdviService';
import {
  computeAgronomicCreditScore,
  evaluateParametricInsuranceClaim,
  type ParametricInsurancePolicy,
} from '../services/agriCreditInsuranceService';
import {
  getTenantBySlug,
  buildTenantScopedQueryFilter,
  validateTenantAdvisoryCompliance,
} from '../services/multiTenantFederationService';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Expanded Platform Capabilities (Satellite NDVI, Credit Score, Multi-Tenancy)', () => {
  describe('Satellite Remote Sensing & Multispectral NDVI Engine', () => {
    it('calculates NDVI correctly for healthy and stressed vegetation', () => {
      // Healthy crop: high NIR (0.7), low Red (0.1) -> NDVI = (0.7 - 0.1) / (0.7 + 0.1) = 0.6 / 0.8 = 0.75
      const healthyNdvi = calculateNdvi(0.7, 0.1);
      expect(healthyNdvi).toBe(0.75);

      // Stressed/barren soil: low NIR (0.2), high Red (0.25) -> NDVI = (0.2 - 0.25) / 0.45 = -0.111
      const stressedNdvi = calculateNdvi(0.2, 0.25);
      expect(stressedNdvi).toBeLessThan(0);
    });

    it('calculates EVI and NDWI canopy moisture indices', () => {
      const evi = calculateEvi(0.65, 0.12, 0.04);
      expect(evi).toBeGreaterThan(0.5);

      const ndwi = calculateNdwi(0.65, 0.18);
      expect(ndwi).toBeGreaterThan(0.4);
    });

    it('classifies vegetation health tiers', () => {
      expect(classifyVegetationHealth(0.75)).toBe('optimal');
      expect(classifyVegetationHealth(0.55)).toBe('normal');
      expect(classifyVegetationHealth(0.35)).toBe('moderate_stress');
      expect(classifyVegetationHealth(0.15)).toBe('severe_stress');
    });

    it('analyzes parcel raster pixels and detects critical drop anomalies', () => {
      const healthyPixels: MultispectralPixel[] = [
        { bandRed: 0.1, bandNir: 0.7, bandGreen: 0.3 },
        { bandRed: 0.12, bandNir: 0.68, bandGreen: 0.32 },
        { bandRed: 0.09, bandNir: 0.72, bandGreen: 0.28 },
      ];

      const analysis = analyzeParcelMultispectral({
        parcelId: 'parcel-101',
        pixels: healthyPixels,
        baselineNdvi: 0.72,
      });

      expect(analysis.vegetationHealthGrade).toBe('optimal');
      expect(analysis.meanNdvi).toBeGreaterThan(0.7);
      expect(analysis.stressAnomaliesDetected).toBe(false);

      // Anomaly case: current NDVI plummets vs baseline
      const stressedPixels: MultispectralPixel[] = [
        { bandRed: 0.25, bandNir: 0.35, bandGreen: 0.2 },
      ];

      const anomalyAnalysis = analyzeParcelMultispectral({
        parcelId: 'parcel-102',
        pixels: stressedPixels,
        baselineNdvi: 0.75, // Dropped to ~0.16
      });

      expect(anomalyAnalysis.stressAnomaliesDetected).toBe(true);
      expect(anomalyAnalysis.recommendedAction).toContain('CRITICAL ANOMALY');
    });
  });

  describe('Smallholder Agronomic Credit Scoring & Parametric Insurance Engine', () => {
    it('scores high-compliance farmers with AAA Prime credit rating', () => {
      const result = computeAgronomicCreditScore({
        farmerId: 'farmer-01',
        farmerName: 'Alice Muthoni',
        acreage: 3.5,
        advisoryCompliancePct: 95,
        completedCropCycles: 4,
        historicalYieldAttainmentPct: 90,
        hasSoilTest: true,
        soilOrganicMatterPct: 3.8,
        fulfilledOfftakeDeliveriesPct: 100,
        hasDiversifiedCrops: true,
      });

      expect(result.creditScore).toBeGreaterThanOrEqual(800);
      expect(result.riskTier).toBe('AAA_Prime');
      expect(result.approvalStatus).toBe('approved');
      expect(result.maxRecommendedLoanKes).toBeGreaterThan(200000);
    });

    it('evaluates parametric weather-index insurance drought claim', () => {
      const policy: ParametricInsurancePolicy = {
        policyId: 'pol-drought-001',
        farmerId: 'farmer-01',
        crop: 'Maize',
        acreage: 2.0,
        coverageType: 'drought_consecutive_dry_days',
        sumInsuredKes: 80000,
        premiumKes: 4800,
        strikeThresholdValue: 18, // 18 dry days
        monitoringWindowDays: 45,
        status: 'active',
      };

      // 21 consecutive dry days observed (> 18 strike threshold)
      const claim = evaluateParametricInsuranceClaim(policy, 21);
      expect(claim.triggerConditionMet).toBe(true);
      expect(claim.payoutPct).toBeGreaterThan(50);
      expect(claim.approvedPayoutKes).toBeGreaterThan(40000);
    });
  });

  describe('Multi-Tenant Agribusiness Federation & Rule Compliance', () => {
    it('finds tenant configuration by slug', () => {
      const tenant = getTenantBySlug('eagf');
      expect(tenant).not.toBeNull();
      expect(tenant?.name).toContain('East Africa Grain');
      expect(tenant?.branding.primaryColorHex).toBe('#10B981');
    });

    it('builds tenant scoped SQL query filter', () => {
      const filter = buildTenantScopedQueryFilter('tenant-123');
      expect(filter.clause).toBe('organization_id = $1');
      expect(filter.param).toBe('tenant-123');
    });

    it('validates custom tenant advisory restrictions against banned chemicals', () => {
      const compliant = validateTenantAdvisoryCompliance('tenant-eagf-01', 'Maize', ['Azadirachtin']);
      expect(compliant.isCompliant).toBe(true);

      const nonCompliant = validateTenantAdvisoryCompliance('tenant-eagf-01', 'Maize', ['Carbofuran']);
      expect(nonCompliant.isCompliant).toBe(false);
      expect(nonCompliant.violatedRestrictions).toContain('Carbofuran');
    });
  });
});
