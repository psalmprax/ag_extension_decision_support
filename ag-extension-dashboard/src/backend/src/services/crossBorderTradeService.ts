/**
 * Cross-border commodity arbitrage estimator — wired via POST /api/pillars/trade/arbitrage.
 *
 * Market prices are a static reference snapshot (not live quotes); freight uses a fixed
 * illustrative corridor distance and border fees are flat estimates, not tariff schedules.
 * All of this is disclosed per response via the `provenance` block. Integrate OSRM/HERE
 * routing and a live price feed before treating outputs as actionable trade signals.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface RegionalMarketHub {
  marketId: string;
  name: string;
  country: string;
  currency: 'KES' | 'UGX' | 'TZS' | 'RWF' | 'ETB' | 'USD';
  fxRateToUsd: number; // 1 USD = X local currency
  commodityPricesPerTon: Record<string, number>; // Commodity -> Local currency per metric ton
}

export interface ArbitrageOpportunity {
  commodity: string;
  originMarket: string;
  originCountry: string;
  destinationMarket: string;
  destinationCountry: string;
  distanceKm: number;
  originPriceUsdPerTon: number;
  destinationPriceUsdPerTon: number;
  grossSpreadUsdPerTon: number;
  freightCostUsdPerTon: number;
  borderTariffAndSpsFeeUsdPerTon: number;
  netArbitrageProfitUsdPerTon: number;
  netMarginPct: number;
  recommendedTrade: boolean;
  provenance: ReturnType<typeof pillarProvenance>;
}

const REGIONAL_MARKETS: RegionalMarketHub[] = [
  {
    marketId: 'mkt-nairobi-01',
    name: 'Nairobi Central Wholesale (Wakulima)',
    country: 'Kenya',
    currency: 'KES',
    fxRateToUsd: 130.0,
    commodityPricesPerTon: {
      Maize: 49500, // $380.7/ton
      DryBeans: 115000, // $884.6/ton
      IrishPotato: 60000, // $461.5/ton
    },
  },
  {
    marketId: 'mkt-kampala-02',
    name: 'Kampala Owino / Kisenyi Grain Market',
    country: 'Uganda',
    currency: 'UGX',
    fxRateToUsd: 3750.0,
    commodityPricesPerTon: {
      Maize: 1050000, // $280.0/ton (Surplus supply)
      DryBeans: 2600000, // $693.3/ton
      IrishPotato: 1200000, // $320.0/ton
    },
  },
  {
    marketId: 'mkt-dar-03',
    name: 'Dar es Salaam Kariakoo Grain Hub',
    country: 'Tanzania',
    currency: 'TZS',
    fxRateToUsd: 2600.0,
    commodityPricesPerTon: {
      Maize: 780000, // $300.0/ton
      DryBeans: 2100000, // $807.6/ton
      IrishPotato: 900000, // $346.1/ton
    },
  },
];

function evaluateMarketPair(
  commodity: string,
  origin: RegionalMarketHub,
  destination: RegionalMarketHub,
  minNetMarginPct: number
): ArbitrageOpportunity | null {
  const originPriceLocal = origin.commodityPricesPerTon[commodity];
  const destPriceLocal = destination.commodityPricesPerTon[commodity];
  if (!originPriceLocal || !destPriceLocal) return null;

  const originPriceUsd = +(originPriceLocal / origin.fxRateToUsd).toFixed(2);
  const destPriceUsd = +(destPriceLocal / destination.fxRateToUsd).toFixed(2);
  const grossSpread = +(destPriceUsd - originPriceUsd).toFixed(2);
  if (grossSpread <= 0) return null;

  // Illustrative freight model: fixed corridor distance; real corridors require OSRM/HERE routing
  const distanceKm = 650;
  const freightCost = +(distanceKm * 0.075).toFixed(2);
  const borderFees = 18.5; // Flat per-ton SPS + bond estimate (not a tariff schedule)

  const netProfit = +(grossSpread - (freightCost + borderFees)).toFixed(2);
  const netMarginPct = +((netProfit / originPriceUsd) * 100).toFixed(1);

  if (netMarginPct < minNetMarginPct) return null;

  return {
    commodity,
    originMarket: origin.name,
    originCountry: origin.country,
    destinationMarket: destination.name,
    destinationCountry: destination.country,
    distanceKm,
    originPriceUsdPerTon: originPriceUsd,
    destinationPriceUsdPerTon: destPriceUsd,
    grossSpreadUsdPerTon: grossSpread,
    freightCostUsdPerTon: freightCost,
    borderTariffAndSpsFeeUsdPerTon: borderFees,
    netArbitrageProfitUsdPerTon: netProfit,
    netMarginPct,
    recommendedTrade: true,
    provenance: pillarProvenance(
      'demo_reference_data',
      'Computed over a static reference price snapshot with an illustrative freight model. Not a live market feed; treat as a screening estimate only.',
      [
        'Prices are a static in-code snapshot (no live feed)',
        'Freight distance fixed at 650km for all corridors',
        'Border fees flat at $18.50/ton (not a tariff schedule)',
      ],
      true
    ),
  };
}

export function findCrossBorderArbitrage(params: {
  commodity: string;
  minNetMarginPct?: number;
}): ArbitrageOpportunity[] {
  const { commodity, minNetMarginPct = 8.0 } = params;
  logger.info(`Analyzing regional cross-border arbitrage opportunities for ${commodity}`);

  const opportunities: ArbitrageOpportunity[] = [];

  for (const origin of REGIONAL_MARKETS) {
    for (const destination of REGIONAL_MARKETS) {
      if (origin.marketId === destination.marketId) continue;
      const opp = evaluateMarketPair(commodity, origin, destination, minNetMarginPct);
      if (opp) opportunities.push(opp);
    }
  }

  return opportunities.sort((a, b) => b.netArbitrageProfitUsdPerTon - a.netArbitrageProfitUsdPerTon);
}

