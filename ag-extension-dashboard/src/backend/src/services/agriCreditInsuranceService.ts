import { logger } from '../utils/logger';

export interface FarmerCreditInput {
  farmerId: string;
  farmerName: string;
  acreage: number;
  advisoryCompliancePct: number; // 0 - 100%
  completedCropCycles: number;
  historicalYieldAttainmentPct: number; // 0 - 100% of regional benchmark
  hasSoilTest: boolean;
  soilOrganicMatterPct?: number;
  fulfilledOfftakeDeliveriesPct: number; // 0 - 100%
  hasDiversifiedCrops: boolean;
}

export interface CreditScoreResult {
  farmerId: string;
  creditScore: number; // 0 - 1000
  riskTier: 'AAA_Prime' | 'AA_Low_Risk' | 'A_Moderate_Risk' | 'B_High_Risk' | 'C_Unqualified';
  breakdown: {
    advisoryComplianceScore: number; // Max 300
    yieldAttainmentScore: number; // Max 250
    soilHealthScore: number; // Max 200
    marketFulfillmentScore: number; // Max 150
    climateResilienceScore: number; // Max 100
  };
  maxRecommendedLoanKes: number;
  maxRecommendedLoanUsd: number;
  interestRateDiscountPct: number;
  approvalStatus: 'approved' | 'review_required' | 'declined';
}

export interface ParametricInsurancePolicy {
  policyId: string;
  farmerId: string;
  crop: string;
  acreage: number;
  coverageType: 'drought_consecutive_dry_days' | 'excess_rain_flash_flood';
  sumInsuredKes: number;
  premiumKes: number;
  strikeThresholdValue: number; // e.g. 18 consecutive dry days or 120mm rain in 48h
  monitoringWindowDays: number;
  status: 'active' | 'triggered_payout' | 'expired_no_claim';
}

export interface ParametricClaimAssessment {
  policyId: string;
  actualObservedMetric: number; // e.g. 21 dry days
  strikeThreshold: number;
  triggerConditionMet: boolean;
  payoutPct: number; // 0 - 100%
  approvedPayoutKes: number;
  approvedPayoutUsd: number;
  verificationSource: string;
}

const KES_TO_USD = 0.0077;

export function computeAgronomicCreditScore(input: FarmerCreditInput): CreditScoreResult {
  logger.info(`Computing Agronomic Credit Score for farmer ${input.farmerId} (${input.farmerName})`);

  // 1. Advisory Compliance (Max 300)
  const complianceScore = Math.round((Math.min(100, input.advisoryCompliancePct) / 100) * 300);

  // 2. Yield Performance & Cycle Experience (Max 250)
  const expFactor = Math.min(1.0, (input.completedCropCycles || 1) / 4);
  const yieldScore = Math.round((Math.min(100, input.historicalYieldAttainmentPct) / 100) * 200 + expFactor * 50);

  // 3. Soil Health & Land Baseline (Max 200)
  let soilScore = input.hasSoilTest ? 100 : 30;
  if (input.soilOrganicMatterPct) {
    soilScore += Math.min(100, Math.round((input.soilOrganicMatterPct / 4.0) * 100));
  } else {
    soilScore += 30;
  }

  // 4. Market Offtake Delivery Reliability (Max 150)
  const marketScore = Math.round((Math.min(100, input.fulfilledOfftakeDeliveriesPct) / 100) * 150);

  // 5. Climate Resilience & Diversification (Max 100)
  const climateScore = input.hasDiversifiedCrops ? 100 : 50;

  const totalScore = Math.min(1000, complianceScore + yieldScore + soilScore + marketScore + climateScore);

  let riskTier: CreditScoreResult['riskTier'] = 'C_Unqualified';
  let maxLoanKes = 0;
  let interestDiscount = 0;
  let approvalStatus: CreditScoreResult['approvalStatus'] = 'declined';

  if (totalScore >= 800) {
    riskTier = 'AAA_Prime';
    maxLoanKes = Math.round(input.acreage * 95000);
    interestDiscount = 3.5;
    approvalStatus = 'approved';
  } else if (totalScore >= 700) {
    riskTier = 'AA_Low_Risk';
    maxLoanKes = Math.round(input.acreage * 70000);
    interestDiscount = 2.0;
    approvalStatus = 'approved';
  } else if (totalScore >= 600) {
    riskTier = 'A_Moderate_Risk';
    maxLoanKes = Math.round(input.acreage * 45000);
    interestDiscount = 0.5;
    approvalStatus = 'approved';
  } else if (totalScore >= 500) {
    riskTier = 'B_High_Risk';
    maxLoanKes = Math.round(input.acreage * 25000);
    interestDiscount = 0;
    approvalStatus = 'review_required';
  }

  return {
    farmerId: input.farmerId,
    creditScore: totalScore,
    riskTier,
    breakdown: {
      advisoryComplianceScore: complianceScore,
      yieldAttainmentScore: yieldScore,
      soilHealthScore: soilScore,
      marketFulfillmentScore: marketScore,
      climateResilienceScore: climateScore,
    },
    maxRecommendedLoanKes: maxLoanKes,
    maxRecommendedLoanUsd: Math.round(maxLoanKes * KES_TO_USD),
    interestRateDiscountPct: interestDiscount,
    approvalStatus,
  };
}

export function evaluateParametricInsuranceClaim(
  policy: ParametricInsurancePolicy,
  observedMetric: number,
  verificationSource: string = 'caller-supplied metric (no satellite feed ingested)'
): ParametricClaimAssessment {
  logger.info(`Evaluating parametric claim for policy ${policy.policyId}: Observed=${observedMetric}, Strike=${policy.strikeThresholdValue}`);

  const triggerMet = observedMetric >= policy.strikeThresholdValue;
  let payoutPct = 0;

  if (triggerMet) {
    // Progressive payout scale based on severity over strike threshold
    const excess = observedMetric - policy.strikeThresholdValue;
    payoutPct = Math.min(100, Math.round(50 + excess * 10));
  }

  const approvedPayoutKes = Math.round((payoutPct / 100) * policy.sumInsuredKes);
  const approvedPayoutUsd = Math.round(approvedPayoutKes * KES_TO_USD);

  return {
    policyId: policy.policyId,
    actualObservedMetric: observedMetric,
    strikeThreshold: policy.strikeThresholdValue,
    triggerConditionMet: triggerMet,
    payoutPct,
    approvedPayoutKes,
    approvedPayoutUsd,
    verificationSource,
  };
}
