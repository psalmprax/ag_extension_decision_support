/**
 * @deprecated Specification phase only — not wired to any API surface (route, tool, worker, or app.ts).
 * See docs/PILLAR_SERVICES_DECISION.md for details.
 * These services exist only in test files and have no production integration.
 */
import { logger } from '../utils/logger';

export interface PlotFinancials {
  yieldTonsPerHectare: number;
  inputCostsPerHectareKes: {
    certifiedSeeds: number;
    plantingFertilizer: number;
    topDressingFertilizer: number;
    limeOrBiochar: number;
    pestControl: number;
    laborAndFieldWork: number;
    total: number;
  };
  commodityPricePerTonKes: number;
  grossRevenueKes: number;
  netProfitKes: number;
}

export interface AgronomicRoiReport {
  crop: string;
  hectares: number;
  controlPlot: PlotFinancials;
  advisoryGuidedPlot: PlotFinancials;
  differential: {
    yieldGainTonsPerHectare: number;
    yieldGainPct: number;
    incrementalInputCostKes: number;
    netProfitGainKes: number;
    netProfitGainUsd: number;
    benefitCostRatio: number; // Return per 1 KES invested
    breakEvenPricePerTonKes: number;
  };
  executiveSummary: string;
}

const KES_TO_USD_RATE = 0.0077; // ~130 KES/USD

export function calculateAgronomicRoi(params: {
  crop: string;
  hectares?: number;
  commodityPricePerTonKes?: number;
  controlYieldTons?: number;
  advisoryYieldTons?: number;
}): AgronomicRoiReport {
  const {
    crop,
    hectares = 1.0,
    commodityPricePerTonKes = 48000,
    controlYieldTons = 2.4, // baseline smallholder yield (t/ha)
    advisoryYieldTons = 4.6, // decision-support guided yield (t/ha)
  } = params;

  logger.info(`Computing Agronomic ROI for ${crop} on ${hectares} ha`);

  // Control Plot Costs (Traditional/informal inputs)
  const controlCosts = {
    certifiedSeeds: 4500, // saved/uncertified seeds
    plantingFertilizer: 8000, // sub-optimal DAP
    topDressingFertilizer: 4000, // partial CAN
    limeOrBiochar: 0,
    pestControl: 1500,
    laborAndFieldWork: 12000,
    total: 30000,
  };

  // Advisory-Guided Plot Costs (Calibrated N-P-K, Lime, Certified Seed, IPM)
  const advisoryCosts = {
    certifiedSeeds: 9000, // High-yielding hybrid seed
    plantingFertilizer: 16000, // Soil-test calibrated compound NPK
    topDressingFertilizer: 8000, // Split-applied CAN at V6
    limeOrBiochar: 5000, // pH correction lime
    pestControl: 3500, // Biological + IPM targeted control
    laborAndFieldWork: 14500,
    total: 56000,
  };

  const controlGrossRevenue = controlYieldTons * commodityPricePerTonKes;
  const controlNetProfit = controlGrossRevenue - controlCosts.total;

  const advisoryGrossRevenue = advisoryYieldTons * commodityPricePerTonKes;
  const advisoryNetProfit = advisoryGrossRevenue - advisoryCosts.total;

  const yieldGainTons = +(advisoryYieldTons - controlYieldTons).toFixed(2);
  const yieldGainPct = +((yieldGainTons / controlYieldTons) * 100).toFixed(1);
  const incrementalCost = advisoryCosts.total - controlCosts.total;
  const netProfitGain = advisoryNetProfit - controlNetProfit;
  const benefitCostRatio = +(netProfitGain / (incrementalCost || 1)).toFixed(2);
  const breakEvenPrice = Math.round(advisoryCosts.total / advisoryYieldTons);

  const controlPlot: PlotFinancials = {
    yieldTonsPerHectare: controlYieldTons,
    inputCostsPerHectareKes: controlCosts,
    commodityPricePerTonKes,
    grossRevenueKes: Math.round(controlGrossRevenue),
    netProfitKes: Math.round(controlNetProfit),
  };

  const advisoryGuidedPlot: PlotFinancials = {
    yieldTonsPerHectare: advisoryYieldTons,
    inputCostsPerHectareKes: advisoryCosts,
    commodityPricePerTonKes,
    grossRevenueKes: Math.round(advisoryGrossRevenue),
    netProfitKes: Math.round(advisoryNetProfit),
  };

  return {
    crop,
    hectares,
    controlPlot,
    advisoryGuidedPlot,
    differential: {
      yieldGainTonsPerHectare: yieldGainTons,
      yieldGainPct,
      incrementalInputCostKes: incrementalCost,
      netProfitGainKes: Math.round(netProfitGain * hectares),
      netProfitGainUsd: Math.round(netProfitGain * hectares * KES_TO_USD_RATE),
      benefitCostRatio,
      breakEvenPricePerTonKes: breakEvenPrice,
    },
    executiveSummary: `Advisory decision support increased ${crop} yield by +${yieldGainPct}% (+${yieldGainTons} t/ha), delivering a net profit gain of +KES ${Math.round(netProfitGain).toLocaleString()} (+$${Math.round(netProfitGain * KES_TO_USD_RATE)}) per hectare with a Benefit-Cost Ratio of ${benefitCostRatio}x.`,
  };
}
