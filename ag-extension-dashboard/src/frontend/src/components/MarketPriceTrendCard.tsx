import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, TrendingUp, Truck, Database, Globe, History } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  fetchMarketPricesWithMetadata,
  fetchPriceHistory,
  type MarketPricesResponse,
  type MarketDataStatus,
  type PriceHistorySeries,
} from '@/api/priceService';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { chartTick } from '@/components/charts/chartConfig';
import { CH_COLORS } from '@/lib/colors';

// ── Helpers ─────────────────────────────────────────────────────────

function parseNumericPrice(priceStr: string): number {
  // "KES 4,200" → 4200, "NGN 85,000" → 85000, "$1,234.50" → 1234.5
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseTrendPct(trend: string): number {
  // "+3.2%" → 3.2, "-1.5%" → -1.5, "Stable" → 0
  const match = trend.match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

const SOURCE_LABELS: Record<string, string> = {
  faostat_producer_prices: 'FAOSTAT Producer Prices',
  giews_fpma: 'GIEWS FPMA',
  usda_fas_psd: 'USDA FAS PSD',
  baseline_estimate: 'Baseline Estimate',
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  faostat_producer_prices: Globe,
  giews_fpma: Globe,
  usda_fas_psd: Globe,
  baseline_estimate: Database,
};

const DATA_STATUS_STYLE: Record<MarketDataStatus, string> = {
  live: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  estimated: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  unavailable: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

// Distinct hue cycle for the multi-crop history line chart.
const HISTORY_COLORS = [
  CH_COLORS.blue,
  CH_COLORS.purple,
  CH_COLORS.cyber,
  CH_COLORS.green,
  CH_COLORS.warning,
  CH_COLORS.success,
  CH_COLORS.gray,
];

function formatAxisValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ── Chart data shape ─────────────────────────────────────────────────

interface PriceChartRow {
  crop: string;
  price: number;
  trendPct: number;
  formattedPrice: string;
  source: string;
}

interface HistoryChartModel {
  series: PriceHistorySeries[];
  merged: Array<Record<string, string | number>>;
}

function mergeHistorySeries(historyData?: PriceHistorySeries[]): HistoryChartModel {
  const series = historyData || [];
  const dateMap = new Map<string, Record<string, string | number>>();
  for (const s of series) {
    for (const pt of s.series) {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
      dateMap.get(pt.date)![s.crop] = pt.price;
    }
  }
  const merged = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  return { series, merged };
}

// ── Sub-components ──────────────────────────────────────────────────

const PriceSummaryGrid: React.FC<{ rows: PriceChartRow[] }> = ({ rows }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
    {rows.map((row, i) => (
      <motion.div
        key={row.crop}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 }}
        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-primary-500/20 transition-colors"
      >
        <div className="min-w-0 pr-2">
          <p className="text-xs font-bold text-white truncate">{row.crop}</p>
          <p className="text-xxs text-white/30 font-mono mt-0.5">{SOURCE_LABELS[row.source] || row.source}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-white tabular-nums">{row.formattedPrice}</p>
          <p className={`text-xxs font-bold tabular-nums ${row.trendPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {row.trendPct >= 0 ? '+' : ''}{row.trendPct.toFixed(1)}%
          </p>
        </div>
      </motion.div>
    ))}
  </div>
);

const PriceHistorySection: React.FC = () => {
  const { data: historyData, isLoading } = useQuery<PriceHistorySeries[]>({
    queryKey: ['analytics-price-history'],
    queryFn: () => fetchPriceHistory(30),
    enabled: !!localStorage.getItem('token'),
    staleTime: 5 * 60 * 1000,
  });

  const history = useMemo(() => mergeHistorySeries(historyData), [historyData]);
  const hasHistory = history.merged.length >= 2;

  return (
    <div className="pt-2 border-t border-white/5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
          <History className="w-3.5 h-3.5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">30-Day Price History</h4>
          <p className="text-xxs text-white/40">
            Local-currency snapshots — daily movement reflects FX conversion of FAOSTAT/GIEWS baselines.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
        </div>
      ) : !hasHistory ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <History className="w-8 h-8 text-white/20 mb-2" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider">History building</p>
          <p className="text-xxs text-white/30 mt-1">
            Snapshots appear after the first few daily fetches (live data only — estimates are excluded).
          </p>
        </div>
      ) : (
        <>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.merged} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ ...chartTick, fontSize: 9 }}
                  minTickGap={24}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  tickFormatter={formatAxisValue}
                />
                <Tooltip content={<ChartTooltip />} labelFormatter={(d: string) => String(d)} />
                {history.series.map((s, i) => (
                  <Line
                    key={s.crop}
                    type="monotone"
                    dataKey={s.crop}
                    stroke={HISTORY_COLORS[i % HISTORY_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            {history.series.map((s, i) => (
              <span key={s.crop} className="flex items-center gap-1.5 text-xxs text-white/60">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: HISTORY_COLORS[i % HISTORY_COLORS.length] }}
                />
                {s.crop}
                {s.dataStatus === 'live' && (
                  <span className="text-emerald-400 font-bold uppercase">· live</span>
                )}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────

export const MarketPriceTrendCard: React.FC = () => {
  const { data, isLoading, isError } = useQuery<MarketPricesResponse>({
    queryKey: ['analytics-market-prices'],
    queryFn: fetchMarketPricesWithMetadata,
    enabled: !!localStorage.getItem('token'),
    staleTime: 5 * 60 * 1000,
  });

  const chartData: PriceChartRow[] = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map(item => ({
      crop: item.crop,
      price: parseNumericPrice(item.price),
      trendPct: parseTrendPct(item.trend),
      formattedPrice: item.price,
      source: item.source,
    }));
  }, [data]);

  const metadata = data?.metadata;
  const sourceLabel = metadata?.source ? SOURCE_LABELS[metadata.source] || metadata.source : null;
  const SourceIcon = metadata?.source ? SOURCE_ICONS[metadata.source] || Globe : Globe;
  const maxPrice = Math.max(1, ...chartData.map(d => d.price));

  return (
    <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* ── Header with metadata ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Commodity Market Prices
            </h3>
          </div>
          <p className="text-xs text-white/50">
            Real-time producer price benchmarks per crop &mdash; sourced from global agricultural data APIs.
          </p>
        </div>

        {/* Badges: source + status */}
        <div className="flex flex-wrap items-center gap-2">
          {sourceLabel && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/80 font-medium">
              <SourceIcon className="w-3.5 h-3.5 text-primary-400" />
              {sourceLabel}
            </span>
          )}
          {metadata?.dataStatus && (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${DATA_STATUS_STYLE[metadata.dataStatus]}`}>
              {metadata.dataStatus}
            </span>
          )}
          {metadata?.exchangeRateSource && (
            <span className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-xxs text-white/40 font-mono uppercase">
              FX: {metadata.exchangeRateSource}
            </span>
          )}
        </div>
      </div>

      {/* ── Loading / Error / Empty ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database className="w-10 h-10 text-white/20 mb-3" />
          <p className="text-sm font-bold text-white/40 uppercase tracking-wider">Market data unavailable</p>
          <p className="text-xs text-white/30 mt-1">FAOSTAT, GIEWS, and USDA APIs are unreachable. Retrying automatically.</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Truck className="w-10 h-10 text-white/20 mb-3" />
          <p className="text-sm font-bold text-white/40 uppercase tracking-wider">No price data yet</p>
          <p className="text-xs text-white/30 mt-1">Market data will appear once FAOSTAT producer prices are available.</p>
        </div>
      ) : (
        <>
          {/* ── Bar Chart ── */}
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <XAxis dataKey="crop" axisLine={false} tickLine={false} tick={chartTick} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  domain={[0, maxPrice * 1.15]}
                  tickFormatter={formatAxisValue}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  formatter={(value: number, name: string) => {
                    const row = chartData.find(r => r.price === value);
                    return row ? [row.formattedPrice, 'Price'] : [String(value), name];
                  }}
                />
                <Bar dataKey="price" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.trendPct >= 0 ? CH_COLORS.green : entry.trendPct <= -5 ? CH_COLORS.error : CH_COLORS.warning}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── 30-Day History (aggregated Redis snapshots) ── */}
          <PriceHistorySection />

          {/* ── Price summary table ── */}
          <PriceSummaryGrid rows={chartData} />

          {/* ── Footer: fetched timestamp ── */}
          {metadata?.fetchedAt && (
            <div className="flex items-center justify-between pt-2 text-xxs text-white/30">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                Last updated
              </span>
              <span className="font-mono">{new Date(metadata.fetchedAt).toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
