import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppQueries } from '@/hooks/useAppQueries';
import { useAppStore } from '@/store/useAppStore';
import { fetchDashboardData } from '@/api/dashboardService';
import { fetchFarmers } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { useDemoMode } from '@/demo';

vi.mock('@/api/dashboardService', () => ({ fetchDashboardData: vi.fn() }));
vi.mock('@/api/farmerService', () => ({ fetchFarmers: vi.fn() }));
vi.mock('@/api/visitService', () => ({ fetchVisits: vi.fn() }));
vi.mock('@/api/reportService', () => ({ fetchReports: vi.fn() }));
vi.mock('@/api/analyticsService', () => ({ fetchPerformanceData: vi.fn() }));
vi.mock('@/api/billingService', () => ({ getMyTransactions: vi.fn() }));
vi.mock('@/demo', async () => {
  const actual = await vi.importActual<typeof import('@/demo')>('@/demo');
  return { ...actual, useDemoMode: vi.fn() };
});

const mockedDemoMode = vi.mocked(useDemoMode);
const mockedDashboard = vi.mocked(fetchDashboardData);
const mockedFarmers = vi.mocked(fetchFarmers);
const mockedVisits = vi.mocked(fetchVisits);
const mockedPerformance = vi.mocked(fetchPerformanceData);

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useAppQueries runtime orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ user: { id: 'user-1', role: 'admin' } as never, farmers: [] });
    mockedDemoMode.mockReturnValue({ isDemo: false } as ReturnType<typeof useDemoMode>);
    mockedDashboard.mockResolvedValue({ success: true, data: { overview: { totalFarmers: 1 } } } as never);
    mockedFarmers.mockResolvedValue({ success: true, data: { farmers: [{ id: 'farmer-1', firstName: 'Ada', lastName: 'K', region: 'North', crops: ['Maize'], farmSize: 2 }] } } as never);
    mockedVisits.mockResolvedValue({ success: true, data: { visits: [] } } as never);
    mockedPerformance.mockResolvedValue({ success: true, data: { metrics: { resolutionRate: 90 }, timeline: [] } } as never);
  });

  it('loads only the dashboard and farmer queries on the dashboard tab', async () => {
    const { result } = renderHook(() => useAppQueries('dashboard', ''), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.dashboardData).toEqual({ overview: { totalFarmers: 1 } }));

    expect(mockedDashboard).toHaveBeenCalledTimes(1);
    expect(mockedFarmers).toHaveBeenCalledTimes(1);
    expect(mockedVisits).not.toHaveBeenCalled();
    expect(result.current.effectiveFarmers[0]).toMatchObject({ id: 'farmer-1', firstName: 'Ada' });
  });

  it('does not call live APIs for demo mode and returns derived demo data', () => {
    mockedDemoMode.mockReturnValue({ isDemo: true } as ReturnType<typeof useDemoMode>);

    const { result } = renderHook(() => useAppQueries('dashboard', ''), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.effectiveFarmers.length).toBeGreaterThan(0);
    expect(mockedDashboard).not.toHaveBeenCalled();
    expect(mockedFarmers).not.toHaveBeenCalled();
  });

  it('loads visit and analytics queries only on their corresponding tabs', async () => {
    const visits = renderHook(() => useAppQueries('visits', ''), { wrapper: wrapper() });
    await waitFor(() => expect(mockedVisits).toHaveBeenCalledTimes(1));
    expect(mockedDashboard).not.toHaveBeenCalled();
    visits.unmount();

    const analytics = renderHook(() => useAppQueries('analytics', ''), { wrapper: wrapper() });
    await waitFor(() => expect(mockedPerformance).toHaveBeenCalledTimes(1));
    expect(mockedDashboard).not.toHaveBeenCalled();
    analytics.unmount();
  });
});
