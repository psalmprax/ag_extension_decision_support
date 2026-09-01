import { logger } from '../utils/logger';

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

export function findCrossBorderArbitrage(params: {
  commodity: string;
  minNetMarginPct?: number;
}): ArbitrageOpportunity[] {
  const { commodity, minNetMarginPct = 8.0 } = params;
  logger.info(`Analyzing regional cross-border arbitrage opportunities for ${commodity}`);

  const opportunities: ArbitrageOpportunity[] = [];

  for (let i = 0; i < REGIONAL_MARKETS.length; i++) {
    for (let j = 0; j < REGIONAL_MARKETS.length; j++) {
      if (i === j) continue;

      const origin = REGIONAL_MARKETS[i];
      const destination = REGIONAL_MARKETS[j];

      const originPriceLocal = origin.commodityPricesPerTon[commodity];
      const destPriceLocal = destination.commodityPricesPerTon[commodity];

      if (!originPriceLocal || !destPriceLocal) continue;

      const originPriceUsd = +(originPriceLocal / origin.fxRateToUsd).toFixed(2);
      const destPriceUsd = +(destPriceLocal / destination.fxRateToUsd).toFixed(2);

      const grossSpread = +(destPriceUsd - originPriceUsd).toFixed(2);
      if (grossSpread <= 0) continue;

      // Approximate road freight in East Africa: ~$0.075 per ton-km
      const distanceKm = 650; // Kampala to Nairobi average corridor
      const freightCost = +(distanceKm * 0.075).toFixed(2); // ~$48.75/ton
      const borderFees = 18.5; // SPS certificate + transit bond per ton

      const netProfit = +(grossSpread - (freightCost + borderFees)).toFixed(2);
      const netMarginPct = +((netProfit / originPriceUsd) * 100).toFixed(1);

      if (netMarginPct >= minNetMarginPct) {
        opportunities.push({
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
        });
      }
    }
  }

  return opportunities.sort((a, b) => b.netArbitrageProfitUsdPerTon - a.netArbitrageProfitUsdPerTon);
}
