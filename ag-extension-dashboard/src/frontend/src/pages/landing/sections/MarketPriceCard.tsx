import type { LandingPricesSnapshot } from './useLandingPrices';
import { useLanguage } from '@/lib/LanguageContext';

const CROP_LABELS: Record<string, string> = {
  '0112': 'Maize',
  '01591': 'Dry Beans',
  '0115': 'Sorghum',
};

export function MarketPriceCard({ snapshot }: { snapshot: LandingPricesSnapshot | null }) {
  const { t } = useLanguage();
  if (!snapshot) {
    return (
      <div
        data-testid="market-price-card"
        className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5"
      >
        <div className="text-xs font-semibold text-amber-300 flex items-center justify-between">
          <span>{t('ui_market_price_card_illustrative_demo_data')}</span>
          <span className="text-[10px] font-mono text-white/50">{t('ui_market_price_card_not_live_prices')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5">
            <div className="text-[11px] text-white/60">{t('crop_maize')}</div>
            <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{t('ui_market_price_card_kes_3_850')}</div>
            <div className="text-[10px] text-emerald-400 font-mono">{t('ui_market_price_card_2_4_bag')}</div>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5">
            <div className="text-[11px] text-white/60">{t('ui_market_price_card_dry_beans')}</div>
            <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{t('ui_market_price_card_ugx_4_200')}</div>
            <div className="text-[10px] text-emerald-400 font-mono">+1.8% / kg</div>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5">
            <div className="text-[11px] text-white/60">{t('ui_market_price_card_sorghum')}</div>
            <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{t('ui_market_price_card_tzs_1_450')}</div>
            <div className="text-[10px] text-amber-400 font-mono">{t('ui_market_price_card_stable_kg')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="market-price-card"
      className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5"
    >
      <div className="text-xs font-semibold text-amber-300 flex items-center justify-between">
        <span>{t('ui_market_price_card_producer_price')} {snapshot.period ?? 'latest published year'}</span>
        <span className="text-[10px] font-mono text-white/50">USD</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {snapshot.prices.map((price) => {
          const trendUp = (price.yoyPct ?? 0) >= 0;
          const showTrend = price.yoyPct !== null && snapshot.period !== null;
          return (
            <div key={price.cropCode} className="p-2 rounded-lg bg-white/[0.04] border border-white/5">
              <div className="text-[11px] text-white/60">
                {CROP_LABELS[price.cropCode] ?? price.crop}
              </div>
              <div className="text-xs sm:text-sm font-bold text-white mt-0.5 tabular-nums">
                ${price.usdPerBag90kg.toFixed(2)}
              </div>
              <div
                className={`text-[10px] font-mono tabular-nums ${
                  !showTrend ? 'text-white/50' : trendUp ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {showTrend
                  ? `${trendUp ? '+' : ''}${price.yoyPct}% vs ${Number(snapshot.period) - 1}`
                  : 'per 90 kg bag'}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-white/50 leading-relaxed">
        {t('ui_market_price_card_annual_national_producer_price_per_9')}{' '}
        <a
          href="https://www.fao.org/faostat/en/#data/PP"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-300/80 underline underline-offset-2 hover:text-amber-200"
        >
          {snapshot.attribution}
        </a>
      </p>
    </div>
  );
}
