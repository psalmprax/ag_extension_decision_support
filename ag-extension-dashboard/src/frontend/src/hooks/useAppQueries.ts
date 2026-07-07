import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { fetchFarmers } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { getMyTransactions } from '@/api/billingService';
import { useAppStore } from '@/store/useAppStore';

export function useAppQueries(activeTab: string, searchQuery: string) {
  const user = useAppStore(s => s.user);
  const storeFarmers = useAppStore(s => s.farmers);

  const {
    data: dashboardResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    enabled: activeTab === 'dashboard' && !!user,
  });
  const dashboardData = dashboardResponse?.data;

  const { data: farmersResponse } = useQuery({
    queryKey: ['farmers'],
    queryFn: fetchFarmers,
    enabled: (activeTab === 'portfolio' || activeTab === 'dashboard') && !!user,
  });
  const queryFarmers = farmersResponse?.data?.farmers || [];
  const effectiveFarmers = queryFarmers.length > 0 ? queryFarmers : storeFarmers;

  const { data: visitsResponse, refetch: refetchVisits } = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
    enabled: activeTab === 'visits' && !!user,
  });
  const visits = visitsResponse?.data?.visits || [];

  const { data: reportsResponse, refetch: refetchReports } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    enabled: activeTab === 'reports' && !!user,
  });
  const reports = reportsResponse?.data?.reports || [];

  const { data: performanceResponse } = useQuery({
    queryKey: ['performance'],
    queryFn: fetchPerformanceData,
    enabled: (activeTab === 'analytics' || activeTab === 'dashboard') && !!user,
  });
  const performanceData = performanceResponse?.data;

  const { data: transactionsResponse } = useQuery({
    queryKey: ['transactions'],
    queryFn: getMyTransactions,
    enabled: (activeTab === 'billing' || searchQuery.trim().length > 0) && !!user,
  });
  const transactions = transactionsResponse?.data || [];

  return {
    dashboardData,
    isLoading,
    isError,
    effectiveFarmers,
    visits,
    refetchVisits,
    reports,
    refetchReports,
    performanceData,
    transactions,
  };
}
