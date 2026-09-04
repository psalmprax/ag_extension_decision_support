/**
 * Agronomic ROI calculator — wired via POST /api/pillars/roi/calculate.
 *
 * Pure math over caller-supplied yields. Input-cost line items are fixed
 * illustrative budgets (not measured farm data) and are disclosed per response
 * via the `provenance` block. No default yields are invented: callers must
 * supply control/advisory yields or the computation is refused.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

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
  provenance: ReturnType<typeof pillarProvenance>;
}

const KES_TO_USD_RATE = 0.0077; // ~130 KES/USD

export function calculateAgronomicRoi(params: {
  crop: string;
  hectares?: number;
  commodityPricePerTonKes?: number;
  controlYieldTons?: number;
  advisoryYieldTons?: number;
}): AgronomicRoiReport {
  const { crop } = params;
  const hectares = params.hectares ?? 1.0;
  const commodityPricePerTonKes = params.commodityPricePerTonKes ?? 48000;
  const controlYieldTons = params.controlYieldTons;
  const advisoryYieldTons = params.advisoryYieldTons;

  if (
    typeof controlYieldTons !== 'number' ||
    typeof advisoryYieldTons !== 'number' ||
    !(controlYieldTons > 0) ||
    !(advisoryYieldTons > 0)
  ) {
    throw new Error(
      'controlYieldTons and advisoryYieldTons are required and must be positive. ' +
      'No default yields are assumed — supply observed yields from field records.'
    );
  }

  logger.info(`Computing Agronomic ROI for ${crop} on ${hectares} ha (supplied yields ${controlYieldTons}/${advisoryYieldTons} t/ha)`);

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
    provenance: pillarProvenance(
      'deterministic_estimation',
      `ROI math over caller-supplied yields (${controlYieldTons} vs ${advisoryYieldTons} t/ha) at KES ${commodityPricePerTonKes.toLocaleString()}/ton. ` +
      'Input-cost line items are fixed illustrative budgets, not measured farm expenditures.',
      [
        'Control-plot input budget fixed at KES 30,000/ha',
        'Advisory-guided input budget fixed at KES 56,000/ha',
        'Default commodity price KES 48,000/ton when not supplied',
      ]
    ),
  };
}
