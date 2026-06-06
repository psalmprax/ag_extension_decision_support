import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { fetchFarmers } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { getMyTransactions } from '@/api/billingService';
import { fetchUnreadCount } from '@/api/notificationService';
import { useAppStore } from '@/store/useAppStore';
import type { Farmer } from '@/types/dashboard';

export function useDashboardQueries(activeTab: string, searchQuery: string) {
    const user = useAppStore((s) => s.user);
    const storeUser = useAppStore((s) => s.user);
    const storeFarmers = useAppStore((s) => s.farmers);

    // Fetch unread notification count
    const [apiUnreadCount, setApiUnreadCount] = useState(0);

    useEffect(() => {
        if (!storeUser || !localStorage.getItem('token')) return;
        const loadUnreadCount = async () => {
            try { setApiUnreadCount(await fetchUnreadCount()); } catch { /* fallback */ }
        };
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 60000);
        return () => clearInterval(interval);
    }, [storeUser]);

    // Dashboard data
    const { data: dashboardResponse, isLoading, isError } = useQuery({
        queryKey: ['dashboard'], queryFn: fetchDashboardData,
        enabled: activeTab === 'dashboard' && !!user
    });
    const dashboardData = dashboardResponse?.data;

    // Farmers
    const { data: farmersResponse } = useQuery({
        queryKey: ['farmers'], queryFn: fetchFarmers,
        enabled: (activeTab === 'portfolio' || activeTab === 'dashboard') && !!user
    });
    const queryFarmers: Farmer[] = farmersResponse?.data?.farmers || [];
    const effectiveFarmers = queryFarmers.length > 0 ? queryFarmers : storeFarmers;

    // Visits
    const { data: visitsResponse, refetch: refetchVisits } = useQuery({
        queryKey: ['visits'], queryFn: fetchVisits,
        enabled: activeTab === 'visits' && !!user
    });
    const visits = visitsResponse?.data?.visits || [];

    // Reports
    const { data: reportsResponse, refetch: refetchReports } = useQuery({
        queryKey: ['reports'], queryFn: fetchReports,
        enabled: activeTab === 'reports' && !!user
    });
    const reports = reportsResponse?.data?.reports || [];

    // Performance / Analytics
    const { data: performanceResponse } = useQuery({
        queryKey: ['performance'], queryFn: fetchPerformanceData,
        enabled: (activeTab === 'analytics' || activeTab === 'dashboard') && !!user
    });
    const performanceData = performanceResponse?.data;

    // Transactions
    const { data: transactionsResponse } = useQuery({
        queryKey: ['transactions'], queryFn: getMyTransactions,
        enabled: (activeTab === 'billing' || searchQuery.trim().length > 0) && !!user
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
        apiUnreadCount,
    };
}
