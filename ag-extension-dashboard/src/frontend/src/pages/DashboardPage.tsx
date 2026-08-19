import React, { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
  Sparkles,
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
import { LiveActivityStream } from '@/components/LiveActivityStream';

const REGION_MAP_MAX_RETRIES = 3;
const REGION_MAP_RETRY_BASE_DELAY_MS = 800;

interface DashboardPageProps {
  dashboardData: DashboardData | undefined;
  isLoading: boolean;
  isOfficer: boolean;
  performanceData:
    | { metrics?: { resolutionRate?: number; satisfactionScore?: number } }
    | undefined;
  effectiveFarmers: Farmer[];
  isMapExpanded: boolean;
  setIsMapExpanded: (expanded: boolean) => void;
  handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => void;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  user: { role?: string; firstName?: string } | undefined;
  addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
  onOpenUSSDSimulator?: () => void;
}

const DashboardHeader: React.FC<{
  userName?: string;
  t: (key: string) => string;
  headingClass: string;
}> = ({ userName, t, headingClass }) => (
  <div className="mb-12">
    <h1 className={`text-4xl font-black tracking-tight font-headline mb-2 ${headingClass}`}>
      Operations Dashboard
    </h1>
    <p className="text-slate-400 font-headline font-medium text-lg">
      {t('dashboard_welcome').replace('{name}', userName || 'Extension Officer')}
    </p>
  </div>
);

const DashboardStats: React.FC<{
  isLoading: boolean;
  dashboardData?: DashboardData;
  isOfficer: boolean;
  t: (key: string) => string;
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
  if (!dashboardData) return null;
  return (
    <>
      <StatCard
        title={isOfficer ? 'My Farmers' : t('stat_total_farmers')}
        value={dashboardData.overview.totalFarmers}
        change={dashboardData.trends.farmersGrowth}
        icon={Users}
        delay={0}
        {...classes}
      />
      <StatCard
        title={isOfficer ? 'My Active Chats' : t('stat_active_conversations')}
        value={dashboardData.overview.activeConversations}
        change={dashboardData.trends.conversationsGrowth}
        icon={MessageSquare}
        delay={0.05}
        {...classes}
      />
      <StatCard
        title={isOfficer ? 'My Visits (30d)' : t('stat_visits_this_month')}
        value={dashboardData.overview.visitsThisMonth}
        change={dashboardData.trends.visitsGrowth}
        icon={MapPin}
        delay={0.1}
        {...classes}
      />
      <StatCard
        title={isOfficer ? 'Avg. Conversations' : t('stat_avg_satisfaction')}
        value={
          isOfficer
            ? dashboardData.overview.avgConversationsPerFarmer
            : `${dashboardData.overview.avgSatisfaction}/5`
        }
        change={isOfficer ? undefined : dashboardData.trends.satisfactionChange}
        icon={isOfficer ? MessageSquare : Sparkles}
        delay={0.15}
        {...classes}
      />
    </>
  );
};

const ActivePulseCard: React.FC<{ cardClass: string }> = ({ cardClass }) => (
  <div className={cardClass}>
    <div className="flex items-center gap-3 mb-6">
      <div className="w-2 h-2 bg-primary-400 rounded-full animate-ping"></div>
      <h3 className="text-sm font-headline font-bold text-gray-900 dark:text-white uppercase tracking-widest">
        Active Pulse
      </h3>
    </div>
    <div className="space-y-4">
      {[
        { label: 'Sensor Node 04', status: 'Optimal', time: '2m ago' },
        { label: 'Drone Survey', status: 'In Progress', time: 'Active' },
        { label: 'Satellite Sync', status: 'Complete', time: '1h ago' },
      ].map((item, i) => (
        <div
          key={i}
          className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 last:pb-0"
        >
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">
              {item.label}
            </p>
            <p className="text-xxs text-slate-500">{item.time}</p>
          </div>
          <span className="text-xxs font-black text-primary-400 uppercase">{item.status}</span>
        </div>
      ))}
    </div>
  </div>
);

const SupportEfficiencyCard: React.FC<{
  performanceData?: { metrics?: { resolutionRate?: number; satisfactionScore?: number } };
  t: (key: string) => string;
  cardClass: string;
}> = ({ performanceData, t, cardClass }) => {
  const resolutionRate = performanceData?.metrics?.resolutionRate ?? 0;
  const satisfactionScore = performanceData?.metrics?.satisfactionScore ?? 0;
  const satisfactionProgress = satisfactionScore * 20;

  return (
    <div className={`${cardClass} p-8`}>
      <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white mb-6">
        {t('analytics_support_efficiency')}
      </h3>
      {performanceData ? (
        <div className="space-y-6">
          {[
            {
              name: t('analytics_resolution_rate'),
              progress: resolutionRate,
              color: 'bg-primary-400',
            },
            {
              name: t('analytics_satisfaction_score'),
              progress: satisfactionProgress,
              color: 'bg-purple-500',
            },
          ].map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-300">{item.name}</span>
                <span className="text-xs font-black text-primary-400">
                  {Math.round(item.progress)}%
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.progress}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`h-full ${item.color} rounded-full shadow-[0_0_10px_var(--color-outline)]`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
        </div>
      )}
    </div>
  );
};

const DashboardMapSection: React.FC<{
  effectiveFarmers: Farmer[];
  isMapExpanded: boolean;
  setIsMapExpanded: (expanded: boolean) => void;
  handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => void;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  user?: { role?: string; firstName?: string };
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

  // Share state with useAppQueries via the same query key; react-query dedupes.
  // We set retry:false so our own retry hook controls the retry behavior.
  const farmersQuery = useQuery({
    queryKey: ['farmers'],
    queryFn: fetchFarmers,
    enabled: !!userFromStore,
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

  if (showInitialLoading) {
    return <MapSectionSkeleton cardClass={cardClass} radiusClass={radiusClass} t={t} />;
  }

  return (
    <div className={`lg:col-span-2 ${cardClass} group`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary-400" />
          {t('stat_regional_distribution')}
        </h3>
        <div className="flex gap-2">
          <span
            className={`px-2 py-1 bg-primary-400/10 text-primary-400 ${radiusClass} text-xxs font-bold uppercase tracking-widest border border-primary-400/20`}
          >
            {t('stat_kenya_overview') || 'Kenya Overview'}
          </span>
        </div>
      </div>

      <div
        className={`relative h-[400px] bg-slate-950/50 ${radiusClass} overflow-hidden border border-white/5 shadow-inner`}
      >
        {!showFallback && !showSkeletonWithRetry && (
          <FarmerMap
            height="400px"
            isExternalExpanded={isMapExpanded}
            onToggleExpand={setIsMapExpanded}
            farmers={effectiveFarmers.map(f => ({
              id: f.id,
              name: `${f.firstName} ${f.lastName}`,
              lat: f.latitude || -1.2863,
              lng: f.longitude || 36.8172,
              crop: f.crops?.[0] || 'Maize',
              region: f.region || 'Unknown',
              size: f.farmSize || 0,
              phone: f.phone,
              yield: f.yield || 0,
            }))}
            onFarmerClick={farmerData => {
              if (user?.role === 'extension_officer' || user?.role === 'admin') {
                React.startTransition(() => {});
                const farmer = effectiveFarmers.find(f => f.id === farmerData.id) as Farmer;
                if (farmer) handleStartConversation(farmer, 'farmer');
              } else {
                const farmer = effectiveFarmers.find(f => f.id === farmerData.id) as Farmer;
                if (farmer) handleOpenFarmerDetail(farmer);
              }
            }}
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
            className={`absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-3 ${radiusClass} border border-white/10`}
          >
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                <span className="text-xxs font-bold text-slate-300 uppercase tracking-widest">
                  {t('table_active')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-xxs font-bold text-slate-300 uppercase tracking-widest">
                  {t('analytics_disease_alerts')}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMapExpanded(true)}
              className={`text-xxs font-black text-primary-400 uppercase bg-primary-400/10 px-3 py-1 ${radiusClass} border border-primary-400/20 hover:bg-primary-400/20 transition-colors`}
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
      <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary-400" />
        {t('stat_regional_distribution')}
      </h3>
      <div className="flex gap-2">
        <span
          className={`px-2 py-1 bg-primary-400/10 text-primary-400 ${radiusClass} text-xxs font-bold uppercase tracking-widest border border-primary-400/20`}
        >
          {t('stat_kenya_overview') || 'Kenya Overview'}
        </span>
      </div>
    </div>
    <div
      className={`relative h-[400px] bg-slate-950/50 ${radiusClass} overflow-hidden border border-white/5 shadow-inner flex items-center justify-center`}
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
    <span className="text-xxs font-bold text-amber-400 uppercase tracking-widest">
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

const DistributionPanels: React.FC<{
  dashboardData?: DashboardData;
  t: (key: string) => string;
  cardClass: string;
}> = ({ dashboardData, t, cardClass }) => {
  const crops = dashboardData?.crops || [];
  const regions = dashboardData?.geography || [];
  const maxCropCount = Math.max(1, ...crops.map(c => c.count));
  const maxRegionCount = Math.max(1, ...regions.map(r => r.farmers));

  if (crops.length === 0 && regions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white">
            {t('viz_crop_planning') || 'Crop Distribution'}
          </h3>
        </div>
        <div className="space-y-4">
          {crops.map(crop => (
            <div key={crop.name}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-slate-300">{crop.name}</span>
                <span className="text-xs font-black text-emerald-400">{crop.count}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(crop.count / maxCropCount) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white">
            {t('stat_regional_distribution') || 'Regional Distribution'}
          </h3>
        </div>
        <div className="space-y-4">
          {regions.map(region => (
            <div key={region.region}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-slate-300">{region.region}</span>
                <span className="text-xs font-black text-primary-400">{region.farmers}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(region.farmers / maxRegionCount) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-primary-500 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MapFallbackEmptyState: React.FC<{
  onRetry: () => void;
  t: (key: string) => string;
}> = ({ onRetry, t }) => (
  <div className="absolute inset-0 z-[1100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
    <div className="bg-white/95 dark:bg-gray-800/95 rounded-3xl p-8 shadow-2xl border border-white/20 max-w-sm">
      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
        {t('map_fallback_title') || 'Unable to Load Distribution'}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-6">
        {t('map_fallback_desc') ||
          'We could not retrieve the regional distribution data after multiple attempts. Please check your connection and try again.'}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xxs font-black uppercase tracking-widest transition-all flex items-center gap-2 mx-auto"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('action_try_again') || 'Try Again'}
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

  return (
    <div className="animate-in fade-in duration-500">
      <DashboardHeader userName={user?.firstName} t={t} headingClass={headingClass} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DashboardStats
          isLoading={isLoading}
          dashboardData={dashboardData}
          isOfficer={isOfficer}
          t={t}
          classes={{ cardClass, headingClass, dataClass }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <DashboardMapSection
          effectiveFarmers={effectiveFarmers}
          isMapExpanded={isMapExpanded}
          setIsMapExpanded={setIsMapExpanded}
          handleStartConversation={handleStartConversation}
          handleOpenFarmerDetail={handleOpenFarmerDetail}
          user={user}
          t={t}
          cardClass={cardClass}
          radiusClass={radiusClass}
        />

        <div className="space-y-6">
          <SupportEfficiencyCard performanceData={performanceData} t={t} cardClass={cardClass} />
          <ActivePulseCard cardClass={cardClass} />
        </div>
      </div>

      {/* KnockKnock-style Real-Time Intelligence & Severity Stream */}
      <div className="mb-8">
        <LiveActivityStream
          cardClass={cardClass}
          onOpenUSSDSimulator={onOpenUSSDSimulator}
          onStartChat={(phone, name) => {
            const farmer = effectiveFarmers.find(
              f => f.phone === phone || `${f.firstName} ${f.lastName}` === name
            );
            if (farmer) {
              handleStartConversation(farmer, 'farmer');
            }
          }}
        />
      </div>

      <DistributionPanels dashboardData={dashboardData} t={t} cardClass={cardClass} />
    </div>
  );
};
