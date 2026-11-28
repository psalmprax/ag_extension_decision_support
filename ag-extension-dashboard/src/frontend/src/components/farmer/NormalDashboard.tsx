import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { MessageSquare, Loader2, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketPrices, MarketPrice, MarketDataStatus } from '@/api/priceService';
import { fetchUsdaBenchmark, fetchRecentWeather } from '@/api/agriDataService';
import type { UsdaBenchmarkResult } from '@/api/agriDataService';
import { RecentWeather } from '@/components/weather/RecentWeather';
import { dataStatusLabel } from './dataStatusLabels';
import type { FarmerStats } from '@/api/farmerService';
import { MetricCardSkeleton, ChartSkeleton } from '../Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';

interface NormalDashboardProps {
  stats: Array<{
    title: string;
    value: string;
    icon: React.ElementType;
  }>;
  statsLoading: boolean;
  /** The farmer's own record: its crop, country and location drive the cards below. */
  farm: Pick<FarmerStats, 'crops' | 'country' | 'location'> | null;
}

function trendTone(trend: unknown): string {
  const value = String(trend ?? '').trim();
  if (value.startsWith('+')) return 'text-emerald-700 dark:text-emerald-400';
  if (value.startsWith('-') || value.startsWith('\u2212')) return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-500 dark:text-theme-text-muted';
}

const DATA_STATUS_COLORS: Record<MarketDataStatus, string> = {
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  estimated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  unavailable: 'bg-gray-100 text-gray-500 dark:bg-theme-bg-tertiary dark:text-theme-text-muted',
};

function renderUsdaCard(data: UsdaBenchmarkResult | null | undefined, loading: boolean, t: ReturnType<typeof useLanguage>['t']) {
  const metrics = data?.world?.metrics || data?.country?.metrics || null;

  return (
    <div className="bg-white dark:bg-white/[0.03] p-5 sm:p-6 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            {t('benchmarks_title', { defaultValue: 'Global benchmarks' })}
          </h3>
          <p className="text-xxs text-gray-400 dark:text-theme-text-muted">{t('benchmarks_subtitle', { defaultValue: 'Maize, USDA PSD data' })}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      ) : !metrics ? (
        <div className="text-center py-10 text-gray-500 text-xs font-medium">
          <Globe className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          {t('benchmarks_none', { defaultValue: 'No benchmark data available' })}
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.production != null && (
            <div className="p-4 bg-theme-bg-secondary/50 dark:bg-theme-bg-secondary/50 rounded-xl border border-gray-50 dark:border-white/[0.08]">
              <div className="text-xs text-gray-400 dark:text-theme-text-muted font-medium mb-1">{t('benchmarks_production', { defaultValue: 'Global production' })}</div>
              <div className="text-xl font-medium text-gray-900 dark:text-white">
                {(Number(metrics.production) / 1_000_000).toFixed(1)}M {metrics.unit}
              </div>
            </div>
          )}
          {metrics.yield != null && (
            <div className="p-4 bg-theme-bg-secondary/50 dark:bg-theme-bg-secondary/50 rounded-xl border border-gray-50 dark:border-white/[0.08]">
              <div className="text-xs text-gray-400 dark:text-theme-text-muted font-medium mb-1">{t('benchmarks_yield', { defaultValue: 'Average yield' })}</div>
              <div className="text-xl font-medium text-primary-600 dark:text-primary-400">
                {Number(metrics.yield).toFixed(1)} {metrics.unit.replace('tonnes', 't/ha')}
              </div>
            </div>
          )}
          {metrics.exports != null && (
            <div className="p-4 bg-theme-bg-secondary/50 dark:bg-theme-bg-secondary/50 rounded-xl border border-gray-50 dark:border-white/[0.08]">
              <div className="text-xs text-gray-400 dark:text-theme-text-muted font-medium mb-1">{t('benchmarks_exports', { defaultValue: 'Global exports' })}</div>
              <div className="text-xl font-medium text-emerald-600 dark:text-emerald-400">
                {(Number(metrics.exports) / 1_000_000).toFixed(1)}M {t('unit_tonnes', { defaultValue: 'tonnes' })}
              </div>
            </div>
          )}
          {data?.dataStatus === 'live' && (
            <div className="pt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                USDA PSD
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const NormalDashboard: React.FC<NormalDashboardProps> = ({ stats, statsLoading, farm }) => {
  const { user, showContextMenu, setActiveTab } = useAppStore();
  const { t } = useLanguage();

  const mainCrop = farm?.crops?.[0];
  const farmLocation = farm?.location ?? null;

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
    enabled: !!user,
  });

  const { data: usdaData, isLoading: usdaLoading } = useQuery<UsdaBenchmarkResult | null>({
    queryKey: ['farmer-usda', mainCrop, farm?.country],
    queryFn: () => fetchUsdaBenchmark(mainCrop as string, farm?.country ?? undefined),
    enabled: !!user && !!mainCrop,
    staleTime: 12 * 60 * 60 * 1000,
  });

  const { data: weatherData, isLoading: weatherLoading, isError: weatherError } = useQuery({
    queryKey: ['farmer-recent-weather', farmLocation?.lat, farmLocation?.lng],
    queryFn: () => fetchRecentWeather(farmLocation!.lat, farmLocation!.lng, 14),
    enabled: !!user && !!farmLocation,
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (statsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <header>
          <div className="h-9 w-64 bg-gray-200 dark:bg-white/[0.08] rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-48 bg-gray-100 dark:bg-theme-bg-tertiary rounded-lg animate-pulse" />
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartSkeleton />
          <div className="bg-gray-200 dark:bg-white/[0.08] h-[300px] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        photo="farmerInspecting"
        title={t('nav_dashboard', { defaultValue: 'Dashboard' })}
        description={`${t('farmer_greeting', { name: user?.firstName || t('users_role_farmer') })} ${t('farmer_overview')}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            role="group"
            aria-label={stat.title}
            className="p-4 bg-white dark:bg-white/[0.03] rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] cursor-context-menu"
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
            <div className="flex items-center gap-2 text-slate-500 dark:text-theme-text-muted">
              <stat.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">{stat.title}</p>
            </div>
            <p className="mt-2 text-lg font-medium text-slate-900 dark:text-white break-words">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-white/[0.03] p-5 sm:p-6 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08]">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-6">
            {t('farmer_market_prices')}
            {prices && prices.length > 0 && (
              <span className={`ms-2 px-2 py-0.5 rounded text-xs font-medium align-middle ${DATA_STATUS_COLORS[prices[0].dataStatus]}`}>
                {dataStatusLabel(t, prices[0].dataStatus)}
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
                  className="flex items-center justify-between py-3 border-b last:border-b-0 border-slate-900/[0.06] dark:border-white/[0.06]"
                >
                  <span className="font-medium text-gray-700 dark:text-theme-text-secondary">{item.crop}</span>
                  <div className="text-end">
                    <p className="font-medium font-mono tabular-nums text-slate-900 dark:text-white">{item.price}</p>
                    <p
                      className={`text-xs font-mono tabular-nums ${trendTone(item.trend)}`}
                    >
                      {item.trend}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs font-medium">
                {t('ui_normal_dashboard_no_price_data_available')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-white/[0.08] p-8 rounded-xl shadow-sm text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-xl font-medium mb-2 tracking-tight">{t('farmer_ask_ai')}</h3>
            <p className="text-slate-300 mb-6 font-normal text-sm leading-relaxed max-w-sm">
              {t('farmer_ai_description')}
            </p>
            <button
              onClick={() => setActiveTab('aiassistant')}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors active:scale-95"
            >
              {t('farmer_start_chat')}
            </button>
          </div>
          <MessageSquare className="absolute -bottom-8 -end-8 w-40 h-40 text-white/5 transition-transform" />
        </div>
      </div>

      {/* Row 2 — Recent weather + USDA Benchmarks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-white/[0.03] p-5 sm:p-6 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08]">
          <RecentWeather data={weatherData} loading={weatherLoading} isError={weatherError} hasLocation={!!farmLocation} scope="farm" />
        </div>
        {renderUsdaCard(usdaData, usdaLoading, t)}
      </div>
    </div>
  );
};
