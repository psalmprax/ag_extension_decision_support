import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { fetchFarmers, type Farmer as ApiFarmer } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { getMyTransactions } from '@/api/billingService';
import { useAppStore, type Farmer } from '@/store/useAppStore';
import { useDemoMode, DEMO_FARMERS, buildDemoDashboardData, buildDemoPerformanceData } from '@/demo';
import { isDemoFarmerId } from '@/demo/demoIds';

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
    assignedOfficerId: farmer.assignedOfficerId,
  };
}

export function resolveEffectiveFarmers(
  queryFarmers: ApiFarmer[],
  _storeFarmers: Farmer[],
  isDemo: boolean,
  userRole?: string
): Farmer[] {
  if (isDemo) return DEMO_FARMERS;
  let result = queryFarmers
    .filter(farmer => !isDemoFarmerId(farmer.id) && !('isDemo' in farmer && farmer.isDemo === true))
    .map(mapApiFarmerToStoreFarmer);
  // Client-side role guard: a farmer should only see their own record
  if (userRole === 'farmer' && result.length > 1) {
    result = result.slice(0, 1);
  }
  return result;
}

function isDemoQueryEnabled(condition: boolean, hasUser: boolean, isDemo: boolean): boolean {
  return condition && hasUser && !isDemo;
}

export function useAppQueries(activeTab: string, searchQuery: string) {
  const user = useAppStore(s => s.user);
  const storeFarmers = useAppStore(s => s.farmers);
  const { isDemo } = useDemoMode();
  const hasUser = Boolean(user);
  const hasPaidAccess =
    isDemo ||
    user?.role === 'admin' ||
    Boolean(user && !user.isFree && user.planName && user.planName.toLowerCase() !== 'free');

  const isDashboard = activeTab === 'dashboard';
  const isPortfolioOrDash = isDashboard || activeTab === 'portfolio';
  const isAnalyticsOrDash = isDashboard || activeTab === 'analytics';
  const isBillingOrSearch = activeTab === 'billing' || searchQuery.trim().length > 0;

  const {
    data: dashboardResponse,
    isLoading,
    isError,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['dashboard', user?.id, isDemo],
    queryFn: fetchDashboardData,
    enabled: isDemoQueryEnabled(isDashboard, hasUser, isDemo),
  });

  const { data: farmersResponse } = useQuery({
    queryKey: ['farmers', user?.id, isDemo],
    queryFn: fetchFarmers,
    enabled: isDemoQueryEnabled(isPortfolioOrDash, hasUser, isDemo),
  });

  const effectiveFarmers = resolveEffectiveFarmers(
    farmersResponse?.data?.farmers || [],
    storeFarmers,
    isDemo,
    user?.role
  );

  const { data: visitsResponse, refetch: refetchVisits } = useQuery({
    queryKey: ['visits', user?.id, isDemo, hasPaidAccess],
    queryFn: fetchVisits,
    enabled: isDemoQueryEnabled(activeTab === 'visits' && hasPaidAccess, hasUser, isDemo),
  });

  const { data: reportsResponse, refetch: refetchReports } = useQuery({
    queryKey: ['reports', user?.id, isDemo],
    queryFn: fetchReports,
    enabled: isDemoQueryEnabled(activeTab === 'reports', hasUser, isDemo),
  });

  const { data: performanceResponse } = useQuery({
    queryKey: ['performance', user?.id, isDemo, hasPaidAccess],
    queryFn: fetchPerformanceData,
    enabled: isDemoQueryEnabled(isAnalyticsOrDash && hasPaidAccess, hasUser, isDemo),
  });

  const { data: transactionsResponse } = useQuery({
    queryKey: ['transactions', user?.id, isDemo],
    queryFn: getMyTransactions,
    enabled: isDemoQueryEnabled(isBillingOrSearch, hasUser, isDemo),
  });

  if (isDemo) {
    return {
      dashboardData: buildDemoDashboardData(effectiveFarmers),
      isLoading: false,
      isError: false,
      refetchDashboard,
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
    refetchDashboard,
    effectiveFarmers,
    visits: visitsResponse?.data?.visits || [],
    refetchVisits,
    reports: reportsResponse?.data?.reports || [],
    refetchReports,
    performanceData: performanceResponse?.data,
    transactions: transactionsResponse?.data || [],
  };
}
