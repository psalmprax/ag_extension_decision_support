/**
 * Harvest aggregation and offtaker matchmaking — wired via POST /api/pillars/offtake/*.
 *
 * Yields, spot/bulk prices, harvest windows, and the buyer directory are fixed reference
 * values, not live market or CRM data. Disclosed per response via the `provenance` block.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface OfftakerBuyer {
  id: string;
  name: string;
  category: 'miller' | 'processor' | 'exporter' | 'aggregator';
  cropTarget: string;
  targetVolumeTons: number;
  offeringPricePerTonKes: number;
  deliveryLocation: string;
  qualitySpecs: string[];
  contactPhone: string;
  isEscrowBacked: boolean;
}

export interface HarvestAggregationSummary {
  crop: string;
  county: string;
  totalAcreage: number;
  projectedMetricTons: number;
  expectedHarvestWindow: string;
  farmerCount: number;
  spotMarketValueKes: number;
  bulkContractValueKes: number;
  projectedCooperativePremiumKes: number;
  provenance: ReturnType<typeof pillarProvenance>;
}

export interface OfftakerMatchResult {
  aggregation: HarvestAggregationSummary;
  matchedBuyers: Array<{
    buyer: OfftakerBuyer;
    capacityCoveragePct: number;
    totalOfferValueKes: number;
    premiumOverSpotPct: number;
  }>;
  provenance: ReturnType<typeof pillarProvenance>;
}

const ACCREDITED_BUYERS: OfftakerBuyer[] = [
  {
    id: 'buyer-unga-01',
    name: 'Unga Farm Care Millers',
    category: 'miller',
    cropTarget: 'Maize',
    targetVolumeTons: 5000,
    offeringPricePerTonKes: 48000, // 48 KES/kg
    deliveryLocation: 'Nakuru Silos / Eldoret Depot',
    qualitySpecs: ['Moisture content < 13.5%', 'Aflatoxin < 10 ppb', 'Foreign matter < 1.0%'],
    contactPhone: '+254700112233',
    isEscrowBacked: true,
  },
  {
    id: 'buyer-eagc-02',
    name: 'East Africa Grain Council Certified Warehouse',
    category: 'aggregator',
    cropTarget: 'Maize',
    targetVolumeTons: 12000,
    offeringPricePerTonKes: 49500,
    deliveryLocation: 'Kitale Central Silo',
    qualitySpecs: ['EAS Grade 1 Maize Standard', 'Broken grains < 2%'],
    contactPhone: '+254700445566',
    isEscrowBacked: true,
  },
  {
    id: 'buyer-kenchic-03',
    name: 'Equator Feed Processing Ltd',
    category: 'processor',
    cropTarget: 'Sorghum',
    targetVolumeTons: 2500,
    offeringPricePerTonKes: 42000,
    deliveryLocation: 'Naivasha Aggregation Center',
    qualitySpecs: ['Moisture < 12%', 'No mold or insect infestation'],
    contactPhone: '+254700778899',
    isEscrowBacked: true,
  },
];

export function aggregateHarvestProjections(params: {
  crop: string;
  county: string;
  totalAcreage?: number;
  farmerCount?: number;
}): HarvestAggregationSummary {
  const { crop, county, totalAcreage = 450, farmerCount = 180 } = params;

  // Typical East Africa smallholder yields: Maize ~ 1.8 tons/acre with advisory
  const yieldPerAcreTons = crop.toLowerCase().includes('maize') ? 1.8 : 2.2;
  const projectedMetricTons = Math.round(totalAcreage * yieldPerAcreTons);

  const spotPricePerTonKes = 40000; // Local middlemen spot price (reference estimate)
  const bulkPricePerTonKes = 48500; // Direct institutional offtake price (reference estimate)

  const spotMarketValueKes = projectedMetricTons * spotPricePerTonKes;
  const bulkContractValueKes = projectedMetricTons * bulkPricePerTonKes;
  const projectedCooperativePremiumKes = bulkContractValueKes - spotMarketValueKes;

  return {
    crop,
    county,
    totalAcreage,
    projectedMetricTons,
    expectedHarvestWindow: 'October – November 2026',
    farmerCount,
    spotMarketValueKes,
    bulkContractValueKes,
    projectedCooperativePremiumKes,
    provenance: pillarProvenance(
      'deterministic_estimation',
      'Projection uses fixed reference yields and prices, not live market data or per-farm records. Default acreage (450) and farmer count (180) apply when not supplied.',
      [
        'Yield: 1.8 t/acre maize, 2.2 t/acre other crops (reference)',
        'Spot price fixed at KES 40,000/ton, bulk at KES 48,500/ton (reference)',
        'Harvest window is a fixed illustrative string',
      ]
    ),
  };
}

export function matchOfftakerContracts(params: {
  crop: string;
  county: string;
  totalAcreage?: number;
  farmerCount?: number;
}): OfftakerMatchResult {
  const aggregation = aggregateHarvestProjections(params);

  logger.info(`Matching offtake contracts for ${aggregation.projectedMetricTons} tons of ${aggregation.crop} in ${aggregation.county}`);

  const matchingBuyers = ACCREDITED_BUYERS.filter(
    b => b.cropTarget.toLowerCase() === aggregation.crop.toLowerCase()
  );

  const matched = matchingBuyers.map(buyer => {
    const coverage = Math.min(100, Math.round((aggregation.projectedMetricTons / buyer.targetVolumeTons) * 100));
    const totalOfferValueKes = aggregation.projectedMetricTons * buyer.offeringPricePerTonKes;
    const premiumPct = +(((buyer.offeringPricePerTonKes - 40000) / 40000) * 100).toFixed(1);

    return {
      buyer,
      capacityCoveragePct: coverage,
      totalOfferValueKes,
      premiumOverSpotPct: premiumPct,
    };
  });

  return {
    aggregation,
    matchedBuyers: matched,
    provenance: pillarProvenance(
      'demo_reference_data',
      'Buyer directory is a static in-code reference list, not a live offtaker registry. Offer values are projections from reference prices, not binding quotes.',
      ['Accredited-buyer list is in-code demo data (3 buyers)', 'Premium computed against the fixed KES 40,000/ton spot reference'],
      true
    ),
  };
}
