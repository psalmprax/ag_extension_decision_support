import { hasAuthSession } from '@/hooks/useAppAuth';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, Truck, Database, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  fetchMarketPricesWithMetadata,
  fetchRetailPrices,
  type MarketPricesResponse,
  type MarketDataStatus,
} from '@/api/priceService';
import { PriceBarChart } from '@/components/market/PriceBarChart';
import { PriceHistoryChart } from '@/components/market/PriceHistoryChart';
import { formatTrend, toPriceRows, type PriceChartRow } from '@/components/market/marketPriceModel';
import { useLanguage } from '@/lib/LanguageContext';
import { formatLabel } from '@/lib/formatLabel';

const SOURCE_LABELS: Record<string, string> = {
  faostat_producer_prices: 'FAOSTAT Producer Prices',
  giews_fpma: 'GIEWS FPMA',
  usda_fas_psd: 'USDA FAS PSD',
  baseline_estimate: 'Baseline Estimate',
  fewsnet: 'FEWS NET Retail',
  wfp: 'WFP Retail',
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  faostat_producer_prices: Globe,
  giews_fpma: Globe,
  usda_fas_psd: Globe,
  baseline_estimate: Database,
  fewsnet: Globe,
  wfp: Globe,
};

const DATA_STATUS_STYLE: Record<MarketDataStatus, string> = {
  live: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  estimated: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20',
  unavailable: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

/**
 * Per-kg retail medians (FEWS NET / WFP) — own table, never the per-bag axis.
 * Renders nothing when the viewer's country has no supported series.
 */
const RetailSnapshotSection: React.FC<{ rows: PriceChartRow[]; country?: string | null; periodDate?: string | null; source?: string | null }> = ({
  rows,
  country,
  periodDate,
  source,
}) => {
  const { t } = useLanguage();
  if (rows.length === 0) return null;
  const sourceTag = source === 'wfp' ? 'WFP' : 'FEWS NET';
  return (
    <div className="pt-2 space-y-2">
      <div>
        <p className="text-xs font-medium text-slate-900 dark:text-white">
          {t('ui_market_price_trend_card_retail_snapshot')}{country ? ` — ${country}` : ''} ({sourceTag})
        </p>
        <p className="text-xxs text-slate-500 dark:text-white/40 mt-0.5">
          {t('ui_market_price_trend_card_per_kg_retail_medians_across_markets')}
          {periodDate ? ` — ${periodDate.slice(0, 7)}` : ''} {t('ui_market_price_trend_card_monthly_not_comparable_with_per_bag')}
        </p>
      </div>
      <PriceSummaryGrid rows={rows} />
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────

const PriceSummaryGrid: React.FC<{ rows: PriceChartRow[] }> = ({ rows }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
    {rows.map((row, i) => (
      <motion.div
        key={row.crop}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 }}
        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 hover:border-primary-500/20 transition-colors"
      >
        <div className="min-w-0 pe-2">
          <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{row.crop}</p>
          <p className="text-xxs text-slate-400 dark:text-white/30 font-mono mt-0.5">{SOURCE_LABELS[row.source] || row.source}</p>
        </div>
        <div className="text-end shrink-0">
          <p className="text-sm font-medium font-mono tabular-nums text-slate-900 dark:text-white">{row.formattedPrice}</p>
          <p className={`text-xxs font-medium font-mono tabular-nums ${row.trendPct > 0 ? 'text-emerald-700 dark:text-emerald-400' : row.trendPct < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-theme-text-muted'}`}>
            {formatTrend(row.trendPct)}
          </p>
        </div>
      </motion.div>
    ))}
  </div>
);

// ── Component ────────────────────────────────────────────────────────

export const MarketPriceTrendCard: React.FC = () => {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery<MarketPricesResponse>({
    queryKey: ['analytics-market-prices'],
    queryFn: fetchMarketPricesWithMetadata,
    enabled: hasAuthSession(),
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => toPriceRows(data), [data]);

  // Per-kg retail medians (FEWS NET, monthly) for the viewer's country.
  // Separate unit from the per-bag bars above — own table, never the axis.
  const { data: retailData } = useQuery<MarketPricesResponse>({
    queryKey: ['analytics-retail-prices'],
    queryFn: () => fetchRetailPrices(),
    enabled: hasAuthSession(),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const retailRows = useMemo(() => toPriceRows(retailData), [retailData]);

  const metadata = data?.metadata;
  const sourceLabel = metadata?.source ? SOURCE_LABELS[metadata.source] || metadata.source : null;
  const SourceIcon = metadata?.source ? SOURCE_ICONS[metadata.source] || Globe : Globe;

  return (
    <div className="backdrop-blur-xl bg-white dark:bg-theme-bg-secondary/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none space-y-6">
      {/* ── Header with metadata ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-medium text-slate-900 dark:text-white">
              {t('ui_market_price_trend_card_commodity_market_prices')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/50">
            {t('ui_market_price_trend_card_producer_price_benchmarks_per_crop_f')}
          </p>
        </div>

        {/* Badges: source + status */}
        <div className="flex flex-wrap items-center gap-2">
          {sourceLabel && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-white/80 font-medium">
              <SourceIcon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              {sourceLabel}
            </span>
          )}
          {metadata?.dataStatus && (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${DATA_STATUS_STYLE[metadata.dataStatus]}`}>
              {formatLabel(metadata.dataStatus)}
            </span>
          )}
          {metadata?.exchangeRateSource && (
            <span className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-xxs text-slate-500 dark:text-white/40 font-mono">
              FX: {metadata.exchangeRateSource}
            </span>
          )}
        </div>
      </div>

      {/* ── Loading / Error / Empty ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-700 dark:text-amber-400 animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database className="w-10 h-10 text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-sm font-medium text-slate-400">{t('ui_market_price_trend_card_market_data_unavailable')}</p>
          <p className="text-xs text-slate-400 dark:text-white/30 mt-1">{t('ui_market_price_trend_card_faostat_giews_and_usda_apis_are_unre')}</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Truck className="w-10 h-10 text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-sm font-medium text-slate-400">{t('ui_market_price_trend_card_no_price_data_yet')}</p>
          <p className="text-xs text-slate-400 dark:text-white/30 mt-1">{t('ui_market_price_trend_card_market_data_will_appear_once_faostat')}</p>
        </div>
      ) : (
        <>
          <PriceBarChart rows={chartData} sourceLabel={source => SOURCE_LABELS[source] || source} />

          {/* ── 30-Day History (aggregated Redis snapshots) ── */}
          <PriceHistoryChart />

          {/* ── Price summary table ── */}
          <PriceSummaryGrid rows={chartData} />

          <RetailSnapshotSection
            rows={retailRows}
            country={retailData?.metadata?.country}
            periodDate={retailData?.metadata?.periodDate}
            source={retailData?.metadata?.source}
          />

          {/* ── Footer: fetched timestamp ── */}
          {metadata?.fetchedAt && (
            <div className="flex items-center justify-between pt-2 text-xxs text-slate-400 dark:text-white/30">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                {t('ui_market_price_trend_card_last_updated')}
              </span>
              <span className="font-mono">{new Date(metadata.fetchedAt).toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
