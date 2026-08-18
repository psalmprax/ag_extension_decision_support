import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { fetchFarmers, type Farmer as ApiFarmer } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { getMyTransactions } from '@/api/billingService';
import { useAppStore, type Farmer } from '@/store/useAppStore';
import { useDemoMode, DEMO_FARMERS, buildDemoDashboardData, buildDemoPerformanceData } from '@/demo';

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

function isDemoQueryEnabled(condition: boolean, hasUser: boolean, isDemo: boolean): boolean {
  return condition && hasUser && !isDemo;
}

export function useAppQueries(activeTab: string, searchQuery: string) {
  const user = useAppStore(s => s.user);
  const storeFarmers = useAppStore(s => s.farmers);
  const { isDemo } = useDemoMode();
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
