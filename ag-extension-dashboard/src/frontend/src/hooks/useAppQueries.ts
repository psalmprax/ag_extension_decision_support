import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { fetchFarmers, type Farmer as ApiFarmer } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { getMyTransactions } from '@/api/billingService';
import { useAppStore, type Farmer } from '@/store/useAppStore';
import { DEMO_FARMERS } from '@/data/demoFarmers';

function mapApiFarmerToStoreFarmer(farmer: ApiFarmer): Farmer {
  return {
    id: farmer.id,
    firstName: farmer.firstName,
    lastName: farmer.lastName,
    location: farmer.village || farmer.region,
    village: farmer.village,
    phone: farmer.phone,
    languagePreference: farmer.languagePreference,
    crops: farmer.crops,
    farmSize: farmer.farmSize,
    latitude: farmer.locationLat,
    longitude: farmer.locationLng,
    region: farmer.region,
  };
}

export function resolveEffectiveFarmers(
  queryFarmers: ApiFarmer[],
  storeFarmers: Farmer[],
  isDemo: boolean
): Farmer[] {
  if (queryFarmers.length > 0) return queryFarmers.map(mapApiFarmerToStoreFarmer);
  if (storeFarmers.length > 0) return storeFarmers;
  return isDemo ? DEMO_FARMERS : [];
}

// Demo accounts surface the static DEMO_FARMERS dataset on the map, so the
// dashboard metrics must be aggregated from the same source to stay coherent
// with the map instead of falling back to an empty backend aggregation.
function sumFarmerNumeric(farmers: Farmer[], pick: (f: Farmer) => number): number {
  return farmers.reduce((sum, f) => sum + (Number(pick(f)) || 0), 0);
}

function avgFarmerYield(farmers: Farmer[]): number {
  const total = farmers.length;
  const totalYield = sumFarmerNumeric(farmers, f => (f as Farmer & { yield?: number }).yield ?? 0);
  return total > 0 ? totalYield / total : 0;
}

export function buildCropDistribution(farmers: Farmer[]) {
  const counts = new Map<string, number>();
  farmers.forEach(farmer => {
    (farmer.crops || []).forEach(crop => {
      counts.set(crop, (counts.get(crop) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildRegionBreakdown(farmers: Farmer[]) {
  const counts = new Map<string, number>();
  farmers.forEach(farmer => {
    const region = farmer.region || 'Unknown';
    counts.set(region, (counts.get(region) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([region, count]) => ({ region, farmers: count }))
    .sort((a, b) => b.farmers - a.farmers);
}

export function buildDemoDashboardData(farmers: Farmer[]) {
  const totalFarmers = farmers.length;
  const totalHectares = sumFarmerNumeric(farmers, f => f.farmSize ?? 0);
  const avgYield = avgFarmerYield(farmers);
  const activeConversations = Math.max(1, Math.round(totalFarmers * 0.75));
  const visitsThisMonth = Math.max(1, Math.round(totalFarmers * 0.6));

  return {
    overview: {
      totalFarmers,
      totalHectares,
      avgYield: Math.round(avgYield * 10) / 10,
      activeConversations,
      visitsThisMonth,
      avgSatisfaction: 4.6,
      avgConversationsPerFarmer: Math.round((activeConversations / totalFarmers) * 10) / 10,
    },
    trends: {
      farmersGrowth: 4.2,
      conversationsGrowth: 6.1,
      visitsGrowth: 3.4,
      satisfactionChange: 0.2,
    },
    geography: buildRegionBreakdown(farmers),
    crops: buildCropDistribution(farmers),
  };
}

function demoResolutionRate(total: number): number {
  return total > 0 ? Math.round(((total - 1) / total) * 1000) / 10 : 92;
}

export function buildDemoPerformanceData(farmers: Farmer[]) {
  const total = farmers.length;
  return {
    metrics: {
      resolutionRate: demoResolutionRate(total),
      satisfactionScore: 4.6,
      avgResponseTime: '2.4m',
      followUpRate: 68,
      firstContactResolution: 74,
    },
    timeline: farmers.slice(0, 6).map((_f, i) => ({
      date: `Week ${i + 1}`,
      farmers: total,
    })),
  };
}

function isDemoQueryEnabled(condition: boolean, hasUser: boolean, isDemo: boolean): boolean {
  return condition && hasUser && !isDemo;
}

export function useAppQueries(activeTab: string, searchQuery: string) {
  const user = useAppStore(s => s.user);
  const storeFarmers = useAppStore(s => s.farmers);
  const isDemo = useAppStore(s => s.isDemo);
  const hasUser = Boolean(user);

  const isDashboard = activeTab === 'dashboard';
  const isPortfolioOrDash = isDashboard || activeTab === 'portfolio';
  const isAnalyticsOrDash = isDashboard || activeTab === 'analytics';
  const isBillingOrSearch = activeTab === 'billing' || searchQuery.trim().length > 0;

  const {
    data: dashboardResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    enabled: isDemoQueryEnabled(isDashboard, hasUser, isDemo),
  });

  const { data: farmersResponse } = useQuery({
    queryKey: ['farmers'],
    queryFn: fetchFarmers,
    enabled: isDemoQueryEnabled(isPortfolioOrDash, hasUser, isDemo),
  });

  const effectiveFarmers = resolveEffectiveFarmers(
    farmersResponse?.data?.farmers || [],
    storeFarmers,
    isDemo
  );

  const { data: visitsResponse, refetch: refetchVisits } = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
    enabled: isDemoQueryEnabled(activeTab === 'visits', hasUser, isDemo),
  });

  const { data: reportsResponse, refetch: refetchReports } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    enabled: isDemoQueryEnabled(activeTab === 'reports', hasUser, isDemo),
  });

  const { data: performanceResponse } = useQuery({
    queryKey: ['performance'],
    queryFn: fetchPerformanceData,
    enabled: isDemoQueryEnabled(isAnalyticsOrDash, hasUser, isDemo),
  });

  const { data: transactionsResponse } = useQuery({
    queryKey: ['transactions'],
    queryFn: getMyTransactions,
    enabled: isDemoQueryEnabled(isBillingOrSearch, hasUser, isDemo),
  });

  if (isDemo) {
    return {
      dashboardData: buildDemoDashboardData(effectiveFarmers),
      isLoading: false,
      isError: false,
      effectiveFarmers,
      visits: [],
      refetchVisits,
      reports: [],
      refetchReports,
      performanceData: buildDemoPerformanceData(effectiveFarmers),
      transactions: [],
    };
  }

  return {
    dashboardData: dashboardResponse?.data,
    isLoading,
    isError,
    effectiveFarmers,
    visits: visitsResponse?.data?.visits || [],
    refetchVisits,
    reports: reportsResponse?.data?.reports || [],
    refetchReports,
    performanceData: performanceResponse?.data,
    transactions: transactionsResponse?.data || [],
  };
}
