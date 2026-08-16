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

function resolveEffectiveFarmers(
  queryFarmers: ApiFarmer[],
  storeFarmers: Farmer[],
  isDemo: boolean
): Farmer[] {
  if (queryFarmers.length > 0) return queryFarmers.map(mapApiFarmerToStoreFarmer);
  if (storeFarmers.length > 0) return storeFarmers;
  return isDemo ? DEMO_FARMERS : [];
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
    enabled: isDashboard && hasUser,
  });

  const { data: farmersResponse } = useQuery({
    queryKey: ['farmers'],
    queryFn: fetchFarmers,
    enabled: isPortfolioOrDash && hasUser,
  });

  const effectiveFarmers = resolveEffectiveFarmers(
    farmersResponse?.data?.farmers || [],
    storeFarmers,
    isDemo
  );

  const { data: visitsResponse, refetch: refetchVisits } = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
    enabled: activeTab === 'visits' && hasUser,
  });

  const { data: reportsResponse, refetch: refetchReports } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    enabled: activeTab === 'reports' && hasUser,
  });

  const { data: performanceResponse } = useQuery({
    queryKey: ['performance'],
    queryFn: fetchPerformanceData,
    enabled: isAnalyticsOrDash && hasUser,
  });

  const { data: transactionsResponse } = useQuery({
    queryKey: ['transactions'],
    queryFn: getMyTransactions,
    enabled: isBillingOrSearch && hasUser,
  });

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
