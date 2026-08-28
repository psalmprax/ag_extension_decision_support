import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { MessageSquare, Loader2, Sprout, Globe, CloudOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketPrices, MarketPrice, MarketDataStatus } from '@/api/priceService';
import { fetchUsdaBenchmark, fetchNDVITimeSeries } from '@/api/agriDataService';
import type { UsdaBenchmarkResult, NDVIPoint } from '@/api/agriDataService';
import { MetricCardSkeleton, ChartSkeleton } from '../Skeleton';

interface NormalDashboardProps {
  stats: Array<{
    title: string;
    value: string;
    icon: React.ElementType;
    color: string;
    bg: string;
  }>;
  statsLoading: boolean;
}

const DATA_STATUS_LABELS: Record<MarketDataStatus, string> = {
  live: 'LIVE',
  estimated: 'ESTIMATED',
  unavailable: 'UNAVAILABLE',
};

const DATA_STATUS_COLORS: Record<MarketDataStatus, string> = {
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  estimated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  unavailable: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function vegInterpret(ndvi: number): { label: string; color: string } {
  if (ndvi >= 0.7) return { label: 'Lush', color: 'text-emerald-600 dark:text-emerald-400' };
  if (ndvi >= 0.5) return { label: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400' };
  if (ndvi >= 0.35) return { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400' };
  if (ndvi >= 0.2) return { label: 'Stressed', color: 'text-rose-600 dark:text-rose-400' };
  return { label: 'Bare', color: 'text-slate-500' };
}

function barColor(p: NDVIPoint): string {
  return p.ndvi >= 0.5 ? '#10b981' : p.ndvi >= 0.35 ? '#f59e0b' : '#ef4444';
}

function renderVegetationCard(
  data: { data: NDVIPoint[]; dataStatus: string; reason: string } | undefined,
  loading: boolean,
  isError: boolean,
) {
  const points = data?.data || [];
  const latest = points[points.length - 1];
  const ndvi = latest?.ndvi;
  const veg = ndvi != null ? vegInterpret(ndvi) : null;
  const maxBar = Math.max(0.05, ...points.map(p => p.ndvi), 1);

  return (
    <div className="bg-theme-bg-card dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
            Vegetation Health
          </h3>
          <p className="text-xxs text-gray-400 dark:text-gray-500">14-day agroclimatology proxy</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : isError || !veg ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CloudOff className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Vegetation data unavailable
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-5">
            <span className={`text-3xl font-black ${veg.color}`}>
              {ndvi!.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{veg.label}</span>
          </div>

          <div className="flex items-end gap-0.5 h-14 mb-2">
            {points.slice(-14).map((p, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm"
                style={{ height: `${Math.max((p.ndvi / maxBar) * 100, 3)}%`, backgroundColor: barColor(p) }}
              />
            ))}
          </div>

          <div className="flex justify-between text-xxs text-gray-400 dark:text-gray-500 font-mono mt-1">
            <span>{points[0]?.date.slice(5) || ''}</span>
            <span>{points[points.length - 1]?.date.slice(5) || ''}</span>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xxs text-gray-400 dark:text-gray-500 capitalize">{data?.reason || ''}</span>
            <motion.span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {data?.dataStatus === 'live' ? 'NASA POWER' : data?.dataStatus?.toUpperCase()}
            </motion.span>
          </div>
        </>
      )}
    </div>
  );
}

function renderUsdaCard(data: UsdaBenchmarkResult | null | undefined, loading: boolean) {
  const metrics = data?.world?.metrics || data?.country?.metrics || null;

  return (
    <div className="bg-theme-bg-card dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
            Global Benchmarks
          </h3>
          <p className="text-xxs text-gray-400 dark:text-gray-500">Maize · USDA PSD data</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      ) : !metrics ? (
        <div className="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest">
          <Globe className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          No benchmark data available
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.production != null && (
            <div className="p-4 bg-theme-bg-secondary/50 dark:bg-gray-900/50 rounded-xl border border-gray-50 dark:border-gray-800">
              <div className="text-xxs text-gray-400 dark:text-gray-500 uppercase font-bold mb-1 tracking-wider">Global Production</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">
                {(Number(metrics.production) / 1_000_000).toFixed(1)}M {metrics.unit}
              </div>
            </div>
          )}
          {metrics.yield != null && (
            <div className="p-4 bg-theme-bg-secondary/50 dark:bg-gray-900/50 rounded-xl border border-gray-50 dark:border-gray-800">
              <div className="text-xxs text-gray-400 dark:text-gray-500 uppercase font-bold mb-1 tracking-wider">Average Yield</div>
              <div className="text-xl font-black text-primary-600 dark:text-primary-400">
                {Number(metrics.yield).toFixed(1)} {metrics.unit.replace('tonnes', 't/ha')}
              </div>
            </div>
          )}
          {metrics.exports != null && (
            <div className="p-4 bg-theme-bg-secondary/50 dark:bg-gray-900/50 rounded-xl border border-gray-50 dark:border-gray-800">
              <div className="text-xxs text-gray-400 dark:text-gray-500 uppercase font-bold mb-1 tracking-wider">Global Exports</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {(Number(metrics.exports) / 1_000_000).toFixed(1)}M tonnes
              </div>
            </div>
          )}
          {data?.dataStatus === 'live' && (
            <div className="pt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                USDA PSD
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const NormalDashboard: React.FC<NormalDashboardProps> = ({ stats, statsLoading }) => {
  const { user, showContextMenu, setActiveTab } = useAppStore();
  const { t } = useLanguage();

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
    enabled: !!user,
  });

  const { data: usdaData, isLoading: usdaLoading } = useQuery<UsdaBenchmarkResult | null>({
    queryKey: ['farmer-usda'],
    queryFn: () => fetchUsdaBenchmark('Maize'),
    enabled: !!user,
    staleTime: 12 * 60 * 60 * 1000,
  });

  const { data: ndviData, isLoading: ndviLoading, isError: ndviError } = useQuery({
    queryKey: ['farmer-vegetation'],
    queryFn: () => fetchNDVITimeSeries(-1.2863, 36.8172, 14),
    enabled: !!user,
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (statsLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <header>
          <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartSkeleton />
          <div className="bg-gray-200 dark:bg-gray-700 h-[300px] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          {t('farmer_greeting').replace('{name}', user?.firstName || 'Farmer')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('farmer_overview')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-theme-bg-card dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-xl transition-all group cursor-context-menu"
            onContextMenu={e => {
              e.preventDefault();
              showContextMenu({
                x: e.clientX,
                y: e.clientY,
                entityType: 'stat',
                entityId: stat.title.toLowerCase().replace(' ', '_'),
              });
            }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xxs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                  {stat.title}
                </p>
                <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                  {stat.value}
                </p>
              </div>
              <div
                className={`p-3 ${stat.bg} dark:bg-opacity-10 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-theme-bg-card dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
            {t('farmer_market_prices')}
            {prices && prices.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold uppercase align-middle ${DATA_STATUS_COLORS[prices[0].dataStatus]}`}>
                {DATA_STATUS_LABELS[prices[0].dataStatus]}
              </span>
            )}
          </h3>
          <div className="space-y-4">
            {pricesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : prices && prices.length > 0 ? (
              prices.map((item: MarketPrice, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-theme-bg-secondary/50 dark:bg-gray-900/50 rounded-xl border border-gray-50 dark:border-gray-800 transition-colors hover:border-primary-500/30"
                >
                  <span className="font-bold text-gray-700 dark:text-gray-300">{item.crop}</span>
                  <div className="text-right">
                    <p className="font-black text-gray-900 dark:text-white">{item.price}</p>
                    <p
                      className={`text-xxs font-bold ${String(item.trend || '').startsWith('+') ? 'text-emerald-500' : 'text-rose-500'} uppercase tracking-widest`}
                    >
                      {item.trend}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest">
                No price data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-10 rounded-xl shadow-2xl shadow-primary-500/20 text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-3 tracking-tight">{t('farmer_ask_ai')}</h3>
            <p className="text-primary-100 mb-8 font-medium text-lg leading-relaxed max-w-sm">
              {t('farmer_ai_description')}
            </p>
            <button
              onClick={() => setActiveTab('aiassistant')}
              className="px-8 py-3 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 transition-all shadow-xl active:scale-95"
            >
              {t('farmer_start_chat')}
            </button>
          </div>
          <MessageSquare className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
        </div>
      </div>

      {/* Row 2 — Vegetation Health + USDA Benchmarks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {renderVegetationCard(ndviData, ndviLoading, ndviError)}
        {renderUsdaCard(usdaData, usdaLoading)}
      </div>
    </div>
  );
};
