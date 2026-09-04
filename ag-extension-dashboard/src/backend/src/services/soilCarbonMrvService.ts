/**
 * Soil Organic Carbon MRV (IPCC Tier 2 math) — wired via POST /api/pillars/soil/*.
 *
 * Computation is exact IPCC-formula math over caller-supplied lab samples. Credit
 * revenue is indicative only: it is not a Verra-verified inventory and uses a default
 * carbon price and fixed FX rate. Disclosed via the `provenance` block.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface SoilSamplePoint {
  sampleId: string;
  depthCm: number; // e.g. 0-30 cm topsoil
  bulkDensityGPerCm3: number; // e.g. 1.25 g/cm³
  organicMatterPct: number; // % SOM from lab test
  coarseFragmentFraction: number; // e.g. 0.05
  testedAt: string;
}

export interface SoilCarbonAuditResult {
  baselineSocStockTCPerHa: number;
  currentSocStockTCPerHa: number;
  deltaSocTCPerHa: number;
  totalCo2EquivalentSequesteredTons: number; // tCO2e (delta_SOC * 3.67)
  hectaresAudited: number;
  carbonCreditPricePerTonUsd: number;
  estimatedCarbonRevenueUsd: number;
  estimatedCarbonRevenueKes: number;
  complianceTier: 'IPCC Tier 1' | 'IPCC Tier 2 (Soil-Specific MRV)' | 'Verra VM0042 Verified';
  recommendations: string[];
  provenance: ReturnType<typeof pillarProvenance>;
}

const VAN_BEMMELEN_FACTOR = 0.58; // SOM to SOC conversion factor (58% of SOM is Organic Carbon)
const C_TO_CO2_RATIO = 3.667; // Molecular weight ratio (44/12)
const USD_TO_KES_RATE = 130;

/**
 * Calculates Soil Organic Carbon stock (t C/ha) using IPCC Tier 2 formula:
 * SOC_stock = SOM% * 0.58 * Bulk_Density (g/cm³) * Depth (cm) * (1 - Coarse_Fragments) * 100
 */
export function calculateSocStock(sample: SoilSamplePoint): number {
  const socPct = sample.organicMatterPct * VAN_BEMMELEN_FACTOR;
  const depthMeters = sample.depthCm / 100;
  const fineEarthFraction = 1 - (sample.coarseFragmentFraction || 0);

  // t C / ha = (% SOC / 100) * Bulk_Density (t/m³) * Depth (m) * 10,000 m²/ha * fine_earth
  const bulkDensityTPerM3 = sample.bulkDensityGPerCm3; // g/cm³ is numerically equal to t/m³
  const socStock = (socPct / 100) * bulkDensityTPerM3 * depthMeters * 10000 * fineEarthFraction;

  return +socStock.toFixed(2);
}

export function auditSoilCarbonSequestration(params: {
  baselineSample: SoilSamplePoint;
  currentSample: SoilSamplePoint;
  hectares: number;
  carbonCreditPriceUsd?: number;
}): SoilCarbonAuditResult {
  const { baselineSample, currentSample, hectares, carbonCreditPriceUsd = 22.5 } = params;

  logger.info(`Auditing Soil Carbon Sequestration across ${hectares} hectares`);

  const baselineSoc = calculateSocStock(baselineSample);
  const currentSoc = calculateSocStock(currentSample);
  const deltaSocPerHa = +(currentSoc - baselineSoc).toFixed(2);

  const totalDeltaSoc = Math.max(0, deltaSocPerHa * hectares);
  const totalCo2e = +(totalDeltaSoc * C_TO_CO2_RATIO).toFixed(2);

  const estimatedUsd = Math.round(totalCo2e * carbonCreditPriceUsd);
  const estimatedKes = Math.round(estimatedUsd * USD_TO_KES_RATE);

  return {
    baselineSocStockTCPerHa: baselineSoc,
    currentSocStockTCPerHa: currentSoc,
    deltaSocTCPerHa: deltaSocPerHa,
    totalCo2EquivalentSequesteredTons: totalCo2e,
    hectaresAudited: hectares,
    carbonCreditPricePerTonUsd: carbonCreditPriceUsd,
    estimatedCarbonRevenueUsd: estimatedUsd,
    estimatedCarbonRevenueKes: estimatedKes,
    complianceTier: 'IPCC Tier 2 (Soil-Specific MRV)',
    recommendations: [
      'Maintain cover cropping (Mucuna / Desmodium) during fallow windows to sustain microbial biomass',
      'Adopt minimum tillage / direct seeding to prevent aeration oxidation of topsoil organic carbon',
      'Apply 2-3 tons/ha biochar or composted manure annually to build recalcitrant carbon fractions',
    ],
    provenance: pillarProvenance(
      'computed_from_supplied_inputs',
      'SOC stock and delta are IPCC Tier 2 math over caller-supplied lab samples. Revenue is indicative only — not a verified carbon inventory and not a registry credit.',
      [
        'SOM→SOC factor 0.58 (Van Bemmelen); CO2 ratio 44/12',
        'Default carbon price $22.5/tCO2e when not supplied',
        'FX fixed at 130 KES/USD',
      ],
      false
    ),
  };
}
