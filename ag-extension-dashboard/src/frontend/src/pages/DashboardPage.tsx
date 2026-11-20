import { hasAuthSession } from '@/hooks/useAppAuth';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';
import { CardSkeleton } from '@/components/Skeleton';
import { FarmerMap } from '@/components/FarmerMap';
import { StatCard } from '../components/StatCard';
import { Farmer, DashboardData } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { useRetryWithBackoff } from '@/hooks/useRetryWithBackoff';
import { fetchFarmers } from '@/api/farmerService';
import { useOpenFarmerChat } from '@/hooks/useOpenFarmerChat';
import { findFarmer } from '@/lib/farmerMatch';
import { farmerCoordinates } from '@/lib/farmerLocation';
import apiClient from '@/api/client';
import { LiveActivityStream } from '@/components/LiveActivityStream';
import { VegetationHealthCard } from '@/components/VegetationHealthCard';
import { EfficacyCard } from '@/components/efficacy/EfficacyCard';
import { AdvisoriesCard } from '@/components/advisories/AdvisoriesCard';
import { FieldToolsCard } from '@/components/fieldtools/FieldToolsCard';
import { LeaderboardCard } from '@/components/fieldtools/FieldIntelCards';
import { OutbreakBanner } from '@/components/outbreaks/OutbreakBanner';
import { OutreachDeliveryWidget } from '@/components/campaigns/OutreachDeliveryWidget';
import { useDemoMode } from '@/demo';
import { DashboardHeader } from './DashboardHeader';
import type { PerformanceData } from '@/api/analyticsService';
import { SupportEfficiencyCard } from '@/components/dashboard/SupportEfficiencyCard';
import { DistributionPanels } from '@/components/dashboard/DistributionPanels';
import { DashboardToolbar } from '@/components/dashboard/DashboardToolbar';
import { useZoneFarmers } from '@/hooks/useDashboardZone';
import { SoilClimateSampleCard } from '@/components/dashboard/SoilClimateSampleCard';
import { formatLabel } from '@/lib/formatLabel';

const REGION_MAP_MAX_RETRIES = 3;
const REGION_MAP_RETRY_BASE_DELAY_MS = 800;

interface DashboardPageProps {
  dashboardData: DashboardData | undefined;
  isLoading: boolean;
  isOfficer: boolean;
  performanceData:
    | PerformanceData
    | undefined;
  effectiveFarmers: Farmer[];
  isMapExpanded: boolean;
  setIsMapExpanded: (expanded: boolean) => void;
  handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => Promise<boolean>;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  user: { role?: string; firstName?: string } | undefined;
  addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
  onOpenUSSDSimulator?: () => void;
}

const DashboardStats: React.FC<{
  isLoading: boolean;
  dashboardData?: DashboardData;
  isOfficer: boolean;
  t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => string;
  classes: Record<string, string | boolean>;
}> = ({ isLoading, dashboardData, isOfficer, t, classes }) => {
  if (isLoading) {
    return (
      <>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </>
    );
  }
  // No invented fallback figures: a failed load shows dashes, not numbers.
  const overview: Partial<DashboardData['overview']> = dashboardData?.overview ?? {};
  const trends: Partial<DashboardData['trends']> = dashboardData?.trends ?? {};
  return (
    <>
      <StatCard
        title={isOfficer ? t('stat_my_farmers', { defaultValue: 'My farmers' }) : t('stat_total_farmers')}
        value={overview.totalFarmers ?? ''}
        change={trends.farmersGrowth}
        icon={Users}
        delay={0}
        {...classes}
      />
      <StatCard
        title={isOfficer ? t('stat_my_active_chats', { defaultValue: 'Active chats' }) : t('stat_active_conversations')}
        value={overview.activeConversations ?? ''}
        change={trends.conversationsGrowth}
        icon={MessageSquare}
        delay={0.05}
        {...classes}
      />
      <StatCard
        title={isOfficer ? t('stat_my_visits_30d', { defaultValue: 'My Visits (30d)' }) : t('stat_visits_this_month')}
        value={overview.visitsThisMonth ?? ''}
        change={trends.visitsGrowth}
        icon={MapPin}
        delay={0.1}
        {...classes}
      />
      <StatCard
        title={isOfficer ? t('stat_avg_conversations', { defaultValue: 'Conversations per farmer' }) : t('stat_avg_satisfaction')}
        value={
          isOfficer
            ? overview.avgConversationsPerFarmer ?? ''
            : overview.avgSatisfaction ? `${overview.avgSatisfaction}/5` : ''
        }
        change={isOfficer ? undefined : trends.satisfactionChange}
        icon={isOfficer ? MessageSquare : BarChart3}
        delay={0.15}
        {...classes}
      />
    </>
  );
};

const ActivePulseCard: React.FC<{ cardClass: string; isLoading: boolean }> = ({ cardClass, isLoading }) => {
  const { isDemo } = useDemoMode();
  const { t } = useLanguage();
  const { data: health, isLoading: hl, isError } = useQuery({
    queryKey: ['active-pulse-health', isDemo],
    queryFn: async () => {
      if (isDemo) {
        return {
          status: 'healthy',
          environment: 'demo-sandbox',
          uptime: 1234567,
          services: {
            database: 'connected',
            cache: 'connected',
          },
        };
      }
      const res = await apiClient.get('/health');
      return res.data;
    },
    enabled: isDemo || hasAuthSession(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // A failed /health call must not spin forever: surface an honest degraded
  // state; refetchInterval keeps retrying automatically.
  const showLoading = isLoading || hl || (!health && !isError);
  const dbConnected = health?.services?.database === 'connected';
  const cacheConnected = health?.services?.cache === 'connected';
  const uptime = health?.uptime ? formatPulseUptime(health.uptime) : null;

  return (
    <div className={`${cardClass} p-4 sm:p-6`}>
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <h3 className="text-xs sm:text-sm font-headline font-semibold text-gray-900 dark:text-white">
          {t('dashboard_active_pulse', { defaultValue: 'System Health' })}
        </h3>
      </div>
      <div className="space-y-3 sm:space-y-4">
        {isError ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-xs text-slate-500">
              {t('dashboard_pulse_unavailable', { defaultValue: 'Health status unavailable — retrying' })}
            </p>
          </div>
        ) : showLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
          </div>
        ) : (
          <>
            {[
              {
                label: t('dashboard_database', { defaultValue: 'Database' }),
                status: dbConnected ? t('dashboard_connected', { defaultValue: 'Connected' }) : t('dashboard_disconnected', { defaultValue: 'Disconnected' }),
                ok: dbConnected,
              },
              {
                label: t('dashboard_redis_cache', { defaultValue: 'Redis cache' }),
                status: cacheConnected ? t('dashboard_connected', { defaultValue: 'Connected' }) : t('dashboard_disconnected', { defaultValue: 'Disconnected' }),
                ok: cacheConnected,
              },
              {
                label: t('dashboard_uptime', { defaultValue: 'Uptime' }),
                status: uptime || t('dashboard_unknown', { defaultValue: 'Unknown' }),
                ok: !!uptime,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b border-white/5 pb-2.5 sm:pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">
                    {item.label}
                  </p>
                  <p className="text-xxs text-slate-500">{health?.environment || ''}</p>
                </div>
                <span className={`text-xxs font-semibold  ${item.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{formatLabel(item.status)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

function formatPulseUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DashboardMapSection: React.FC<{
  effectiveFarmers: Farmer[];
  isMapExpanded: boolean;
  setIsMapExpanded: (expanded: boolean) => void;
  handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => Promise<boolean>;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  user?: { role?: string; firstName?: string; region?: string } | null;
  t: (key: string) => string;
  cardClass: string;
  radiusClass: string;
}> = ({
  effectiveFarmers,
  isMapExpanded,
  setIsMapExpanded,
  handleStartConversation,
  handleOpenFarmerDetail,
  user,
  t,
  cardClass,
  radiusClass,
}) => {
  const userFromStore = useAppStore(s => s.user);
  const { isDemo } = useDemoMode();
  // Officers/admins open the farmer chat; other roles get the detail view.
  const openFarmerChat = useOpenFarmerChat({
    role: user?.role ?? userFromStore?.role, handleStartConversation, handleOpenFarmerDetail,
  });

  // Share state with useAppQueries via the same query key; react-query dedupes.
  // We set retry:false so our own retry hook controls the retry behavior.
  const farmersQuery = useQuery({
    queryKey: ['farmers'],
    queryFn: fetchFarmers,
    enabled: !!userFromStore && !isDemo,
    retry: false,
  });

  const refetchFarmers = useCallback(async () => {
    const result = await farmersQuery.refetch();
    if (result.isError) {
      throw new Error('Failed to fetch farmers');
    }
    return result.data;
  }, [farmersQuery]);

  const {
    isRetrying,
    attempts,
    execute: refetchWithRetry,
    reset: resetRetry,
  } = useRetryWithBackoff(refetchFarmers, {
    maxAttempts: REGION_MAP_MAX_RETRIES,
    baseDelayMs: REGION_MAP_RETRY_BASE_DELAY_MS,
    maxDelayMs: 8000,
  });

  // Auto-trigger a 3-attempt retry on initial error, but only if we have no
  // offline data to fall back on. Once a retry cycle is in flight, the
  // attempts/0 guard prevents re-triggering.
  useEffect(() => {
    if (farmersQuery.isError && !isRetrying && attempts === 0 && effectiveFarmers.length === 0) {
      refetchWithRetry();
    }
  }, [farmersQuery.isError, isRetrying, attempts, effectiveFarmers.length, refetchWithRetry]);

  // Clear retry bookkeeping once the query is back so a later error can retry cleanly.
  useEffect(() => {
    if (farmersQuery.isSuccess && attempts > 0) {
      resetRetry();
    }
  }, [farmersQuery.isSuccess, attempts, resetRetry]);

  // Derive which UI state to render.
  const hasData = effectiveFarmers.length > 0;
  const showInitialLoading = !hasData && farmersQuery.isLoading;
  const showSkeletonWithRetry = !hasData && isRetrying;
  const showFallback = !hasData && !isRetrying && attempts >= REGION_MAP_MAX_RETRIES;
  const showMapWithRetry = hasData && isRetrying;

  const handleManualRetry = useCallback(() => {
    resetRetry();
    refetchWithRetry();
  }, [resetRetry, refetchWithRetry]);

  // Only farmers with a saved farm position are plottable; nothing is defaulted.
  const mappedFarmers = useMemo(
    () =>
      effectiveFarmers.flatMap(f => {
        const position = farmerCoordinates(f);
        if (!position) return [];
        return [{
          id: f.id, name: `${f.firstName} ${f.lastName}`, lat: position.lat, lng: position.lng,
          crop: f.crops?.[0] || 'Unspecified', region: f.region || 'Unknown',
          size: Number(f.farmSize) || 0, phone: f.phone, yield: f.yield || 0,
        }];
      }),
    [effectiveFarmers]
  );

  if (showInitialLoading) {
    return <MapSectionSkeleton cardClass={cardClass} radiusClass={radiusClass} t={t} />;
  }

  return (
    <div className={`lg:col-span-2 ${cardClass} group p-4 sm:p-6`}>
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <MapPin className="w-[18px] h-[18px] text-slate-500" aria-hidden="true" />
          <span>{t('stat_regional_distribution')}</span>
        </h3>
        <div className="flex gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {isDemo
              ? (t('stat_kenya_overview') || 'Kenya overview')
              : ((user?.region || userFromStore?.region) ? `${user?.region || userFromStore?.region}` : (t('stat_portfolio_overview') || 'Portfolio overview'))}
          </span>
        </div>
      </div>

      <div
        className={`relative h-[300px] sm:h-[400px] ${radiusClass} overflow-hidden`}
      >
        {!showFallback && !showSkeletonWithRetry && (
          <FarmerMap
            height="100%"
            isExternalExpanded={isMapExpanded}
            onToggleExpand={setIsMapExpanded}
            farmers={mappedFarmers}
            onFarmerClick={farmerData => openFarmerChat(effectiveFarmers.find(f => f.id === farmerData.id))}
          />
        )}

        {showMapWithRetry && (
          <MapRetryOverlay attempts={attempts} maxAttempts={REGION_MAP_MAX_RETRIES} t={t} />
        )}

        {showSkeletonWithRetry && (
          <MapSkeletonWithRetry attempts={attempts} maxAttempts={REGION_MAP_MAX_RETRIES} t={t} />
        )}

        {showFallback && <MapFallbackEmptyState onRetry={handleManualRetry} t={t} />}

        {!isMapExpanded && !showFallback && (
          <div
            className={`absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 bg-slate-900/80 backdrop-blur-md p-2 sm:p-3 ${radiusClass} border border-white/10`}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                <span className="text-xxs font-bold text-slate-200  ">
                  {t('table_active')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <span className="text-xs font-medium text-slate-200">
                  {t('analytics_disease_alerts')}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMapExpanded(true)}
              className={`text-xs font-medium text-primary-400 bg-primary-400/10 px-2.5 sm:px-3 py-1 ${radiusClass} border border-primary-400/20 hover:bg-primary-400/20 transition-colors active:scale-95`}
            >
              {t('viz_detail_view')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MapSectionSkeleton: React.FC<{
  cardClass: string;
  radiusClass: string;
  t: (key: string) => string;
}> = ({ cardClass, radiusClass, t }) => (
  <div className={`lg:col-span-2 ${cardClass} group`}>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
        <MapPin className="w-[18px] h-[18px] text-slate-500" aria-hidden="true" />
        {t('stat_regional_distribution')}
      </h3>
    </div>
    <div
      className={`relative h-[400px] bg-slate-100 dark:bg-white/[0.03] ${radiusClass} overflow-hidden flex items-center justify-center`}
      role="status"
      aria-busy="true"
      aria-label={t('map_loading') || 'Loading regional distribution'}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        <p className="text-sm font-medium text-slate-400">
          {t('map_loading_distribution') || 'Loading regional distribution...'}
        </p>
      </div>
    </div>
  </div>
);

const MapRetryOverlay: React.FC<{
  attempts: number;
  maxAttempts: number;
  t: (key: string) => string;
}> = ({ attempts, maxAttempts, t }) => (
  <div
    className="absolute top-4 right-4 z-[1100] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-400/30 shadow-lg"
    role="status"
    aria-live="polite"
  >
    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
    <span className="text-xxs font-bold text-amber-400  ">
      {t('map_retrying') || 'Retrying'} ({attempts}/{maxAttempts})
    </span>
  </div>
);

const MapSkeletonWithRetry: React.FC<{
  attempts: number;
  maxAttempts: number;
  t: (key: string) => string;
}> = ({ attempts, maxAttempts, t }) => (
  <div
    className="absolute inset-0 z-[1100] bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      <p className="text-sm font-medium text-slate-300">
        {t('map_retrying') || 'Retrying'} ({attempts}/{maxAttempts})
      </p>
      <p className="text-xxs text-slate-500">
        {t('map_loading_distribution') || 'Loading regional distribution'}
      </p>
    </div>
  </div>
);

const MapFallbackEmptyState: React.FC<{
  onRetry: () => void;
  t: (key: string) => string;
}> = ({ onRetry, t }) => (
  <div className="absolute inset-0 z-[1100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
    <div className="bg-white/95 dark:bg-gray-800/95 rounded-xl p-8 shadow-2xl border border-white/20 max-w-sm">
      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('map_fallback_title') || 'Unable to load distribution'}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-6">
        {t('map_fallback_desc') ||
          'We could not retrieve the regional distribution data after multiple attempts. Please check your connection and try again.'}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-medium transition-all flex items-center gap-2 mx-auto"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('action_try_again') || 'Try again'}
      </button>
    </div>
  </div>
);

export const DashboardPage: React.FC<DashboardPageProps> = ({
  dashboardData,
  isLoading,
  isOfficer,
  performanceData,
  effectiveFarmers,
  isMapExpanded,
  setIsMapExpanded,
  handleStartConversation,
  handleOpenFarmerDetail,
  user,
  onOpenUSSDSimulator,
}) => {
  const { t } = useLanguage();
  const { cardClass, headingClass, dataClass, radiusClass } =
    useThemeClasses();
  const storeUser = useAppStore(state => state.user);
  const effectiveUser = user || storeUser;
  const isAdmin = effectiveUser?.role === 'admin' || effectiveUser?.role === 'superadmin';
  const { isDemo } = useDemoMode();
  const openFarmerChat = useOpenFarmerChat({ role: effectiveUser?.role, handleStartConversation, handleOpenFarmerDetail });
  const zoneFarmers = useZoneFarmers(effectiveFarmers);

  return (
    <div className="animate-in fade-in duration-500">
      <OutbreakBanner />
      <DashboardHeader userName={effectiveUser?.firstName} t={t} headingClass={headingClass} />
      <DashboardToolbar farmers={effectiveFarmers} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <DashboardStats
          isLoading={isLoading}
          dashboardData={dashboardData}
          isOfficer={isOfficer}
          t={t}
          classes={{ cardClass, headingClass, dataClass }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <DashboardMapSection
          effectiveFarmers={zoneFarmers}
          isMapExpanded={isMapExpanded}
          setIsMapExpanded={setIsMapExpanded}
          handleStartConversation={handleStartConversation}
          handleOpenFarmerDetail={handleOpenFarmerDetail}
          user={effectiveUser}
          t={t}
          cardClass={cardClass}
          radiusClass={radiusClass}
        />

        <div className="space-y-4 sm:space-y-6">
          <VegetationHealthCard cardClass={cardClass} />
          <SupportEfficiencyCard performanceData={performanceData} t={t} cardClass={cardClass} />
        </div>
      </div>

      {/* Balanced Agronomic Intelligence & Field Operations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="space-y-4 sm:space-y-6">
          <FieldToolsCard />
          <LeaderboardCard />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <AdvisoriesCard />
          <EfficacyCard />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <OutreachDeliveryWidget />
          {isAdmin && <ActivePulseCard cardClass={cardClass} isLoading={isLoading} />}
          {!isAdmin && isDemo && <SoilClimateSampleCard cardClass={cardClass} />}
        </div>
      </div>

      {/* KnockKnock-style Real-Time Intelligence & Severity Stream */}
      <div className="mb-6 sm:mb-8">
        <LiveActivityStream
          cardClass={cardClass}
          onOpenUSSDSimulator={onOpenUSSDSimulator}
          onStartChat={ref => openFarmerChat(findFarmer(effectiveFarmers, ref))}
        />
      </div>

      <DistributionPanels dashboardData={dashboardData} t={t} cardClass={cardClass} />
    </div>
  );
};
