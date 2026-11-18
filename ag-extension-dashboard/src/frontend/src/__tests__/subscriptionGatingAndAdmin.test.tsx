import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '@/api/client';
import { fetchPlanQuotas } from '@/api/billingService';
import { useAppStore } from '@/store/useAppStore';
import { TabContent } from '@/components/TabContent';
import { UserManagementPage } from '@/pages/UserManagementPage';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/api/authService', () => ({
  fetchLoginHistory: vi.fn().mockResolvedValue([]),
  fetchLoginStats: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/api/billingService', async () => {
  const actual = await vi.importActual<typeof import('@/api/billingService')>('@/api/billingService');
  return {
    ...actual,
    fetchPlanQuotas: vi.fn(),
  };
});
vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: false }), DEMO_USERS: [] }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: (
      _key: string,
      fallbackOrOpts?: string | { defaultValue?: string },
      vars?: Record<string, string>
    ) => {
      const template =
        typeof fallbackOrOpts === 'string'
          ? fallbackOrOpts
          : fallbackOrOpts?.defaultValue || '';
      return template.replace(/\{(\w+)\}/g, (_m, k) => vars?.[k] ?? '');
    },
  }),
}));

vi.mock('@/pages/DiseaseDiagnosis', () => ({
  DiseaseDiagnosis: () => <div data-testid="disease-diagnosis-module">Disease Diagnosis Live Module</div>,
}));
vi.mock('@/pages/WorldMonitor', () => ({
  default: () => <div data-testid="worldmonitor-module">WorldMonitor Live Module</div>,
}));

const PRO_PLAN_ID = '00000000-0000-0000-0000-000000000002';
const FREE_PLAN_ID = '00000000-0000-0000-0000-000000000001';

function buildTabProps(activeTab: string): React.ComponentProps<typeof TabContent> {
  return {
    activeTab,
    headingClass: '',
    isOfficer: true,
    user: useAppStore.getState().user,
    addNotification: vi.fn(),
    dashboardData: undefined,
    isLoading: false,
    dashboardError: false,
    onRetryDashboard: vi.fn(),
    performanceData: undefined,
    effectiveFarmers: [],
    isMapExpanded: false,
    setIsMapExpanded: vi.fn(),
    handleStartConversation: vi.fn().mockResolvedValue(true),
    handleOpenFarmerDetail: vi.fn(),
    selectedFarmers: new Set(),
    handleSelectFarmer: vi.fn(),
    showBulkSmsComposer: false,
    setShowBulkSmsComposer: vi.fn(),
    bulkSmsMessage: '',
    setBulkSmsMessage: vi.fn(),
    handleBulkSMS: vi.fn(),
    handleBulkExport: vi.fn(),
    handleBulkDelete: vi.fn(),
    setSelectedFarmers: vi.fn(),
    visits: [],
    setShowVisitModal: vi.fn(),
    refetchVisits: vi.fn(),
    reports: [],
    handleGenerateReport: vi.fn(),
    isGeneratingReport: false,
    viewingReport: null,
    setViewingReport: vi.fn(),
    reportContent: null,
    setReportContent: vi.fn(),
    isLoadingReport: false,
    setIsLoadingReport: vi.fn(),
    farmerConversations: [],
    activeFarmerConvId: null,
    setActiveFarmerConvId: vi.fn(),
    loadFarmerMessages: vi.fn(),
    farmerChatMessages: [],
    farmerChatInput: '',
    setFarmerChatInput: vi.fn(),
    handleFarmerChatSend: vi.fn(),
    loadFarmers: vi.fn(),
    setShowFarmerModal: vi.fn(),
  };
}

describe('Subscription gating across Pro tabs & admin tier management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks disease_diagnosis and worldmonitor behind PlanUpgradeGuard for Free users', async () => {
    useAppStore.setState({
      user: {
        id: 'off-free',
        email: 'free@example.org',
        firstName: 'Free',
        lastName: 'Officer',
        role: 'extension_officer',
        planName: 'Free',
        isFree: true,
      },
    });

    const { rerender } = render(
      <MemoryRouter>
        <Suspense fallback={null}>
          <TabContent {...buildTabProps('disease_diagnosis')} />
        </Suspense>
      </MemoryRouter>
    );

    expect(await screen.findByText('Pro Feature Locked')).toBeInTheDocument();
    expect(screen.queryByTestId('disease-diagnosis-module')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <Suspense fallback={null}>
          <TabContent {...buildTabProps('worldmonitor')} />
        </Suspense>
      </MemoryRouter>
    );

    expect(await screen.findByText('Pro Feature Locked')).toBeInTheDocument();
    expect(screen.queryByTestId('worldmonitor-module')).not.toBeInTheDocument();
  });

  it('unlocks disease_diagnosis and worldmonitor for Pro and Admin users', async () => {
    useAppStore.setState({
      user: {
        id: 'off-pro',
        email: 'pro@example.org',
        firstName: 'Pro',
        lastName: 'Officer',
        role: 'extension_officer',
        planName: 'Pro',
        isFree: false,
      },
    });

    const { rerender } = render(
      <MemoryRouter>
        <Suspense fallback={null}>
          <TabContent {...buildTabProps('disease_diagnosis')} />
        </Suspense>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('disease-diagnosis-module')).toBeInTheDocument();

    useAppStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@example.org',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        planName: 'Admin',
        isFree: false,
      },
    });

    rerender(
      <MemoryRouter>
        <Suspense fallback={null}>
          <TabContent {...buildTabProps('worldmonitor')} />
        </Suspense>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('worldmonitor-module')).toBeInTheDocument();
  });

  it('allows admin to upgrade a basic Free user to Pro and change role/status via UserAccessModal', async () => {
    useAppStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@example.org',
        firstName: 'Root',
        lastName: 'Admin',
        role: 'admin',
        planName: 'Admin',
        isFree: false,
      },
    });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-basic',
            firstName: 'Grace',
            lastName: 'Wanjiku',
            email: 'grace@example.org',
            role: 'farmer',
            region: 'Central',
            phone: '',
            isActive: true,
            planId: FREE_PLAN_ID,
            planName: 'Free',
            isFree: true,
            lastLogin: null,
          },
        ],
      },
    });
    vi.mocked(fetchPlanQuotas).mockResolvedValue({
      success: true,
      data: [
        {
          id: FREE_PLAN_ID,
          stripePriceId: 'price_free',
          name: 'Free',
          price: 0,
          currency: 'USD',
          interval: 'month',
          quotas: { smsLimit: 0, aiChatLimit: 0, reportLimit: 0, aiVisionLimit: 0 },
          enforcement: 'hard_limit',
        },
        {
          id: PRO_PLAN_ID,
          stripePriceId: 'price_pro_monthly',
          name: 'Pro',
          price: 29,
          currency: 'USD',
          interval: 'month',
          quotas: { smsLimit: 500, aiChatLimit: 1000, reportLimit: 50, aiVisionLimit: 50 },
          enforcement: 'hard_limit',
        },
      ],
    });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UserManagementPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Grace Wanjiku')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Access' }));

    expect(await screen.findByText('Manage Access & Subscription')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Pro \(USD 29\/month\)/ })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('System Role'), {
      target: { value: 'extension_officer' },
    });
    fireEvent.change(screen.getByLabelText('Subscription Tier (Feature Access)'), {
      target: { value: PRO_PLAN_ID },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Access' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/users/u-basic', {
        role: 'extension_officer',
        planId: PRO_PLAN_ID,
      });
    });
  });

  it('worldmonitor upgrade guard describes implemented spatial summaries instead of an unrendered 3D globe', async () => {
    useAppStore.setState({
      user: {
        id: 'off-free',
        email: 'free@example.org',
        firstName: 'Free',
        lastName: 'Officer',
        role: 'extension_officer',
        planName: 'Free',
        isFree: true,
      },
    });

    render(
      <MemoryRouter>
        <Suspense fallback={null}>
          <TabContent {...buildTabProps('worldmonitor')} />
        </Suspense>
      </MemoryRouter>
    );

    expect(await screen.findByText(/30-day NDVI stress diagnosis counts/i)).toBeInTheDocument();
    expect(screen.queryByText(/3D geospatial globe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/organic carbon/i)).not.toBeInTheDocument();
  });

  it('displays plan loading errors with retry, sends only changed fields, omits unchanged planId, scopes timer/session, and handles Escape', async () => {
    useAppStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@example.org',
        firstName: 'Root',
        lastName: 'Admin',
        role: 'admin',
        planName: 'Admin',
        isFree: false,
      },
    });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-pro',
            firstName: 'Mercy',
            lastName: 'Chebet',
            email: 'mercy@example.org',
            role: 'extension_officer',
            region: 'Eldoret',
            phone: '',
            isActive: true,
            planId: PRO_PLAN_ID,
            planName: 'Pro',
            isFree: false,
            lastLogin: null,
          },
          {
            id: 'u-other',
            firstName: 'Peter',
            lastName: 'Karanja',
            email: 'peter@example.org',
            role: 'farmer',
            region: 'Nakuru',
            phone: '',
            isActive: true,
            planId: FREE_PLAN_ID,
            planName: 'Free',
            isFree: true,
            lastLogin: null,
          },
        ],
      },
    });

    vi.mocked(fetchPlanQuotas)
      .mockResolvedValueOnce({ success: false, error: 'Quotas service unavailable' })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: PRO_PLAN_ID,
            stripePriceId: 'price_pro_monthly',
            name: 'Pro',
            price: 29,
            currency: 'USD',
            interval: 'month',
            quotas: { smsLimit: 500, aiChatLimit: 1000, reportLimit: 50, aiVisionLimit: 50 },
            enforcement: 'hard_limit',
          },
        ],
      });

    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UserManagementPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Mercy Chebet')).toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: 'Edit Access' });
    fireEvent.click(editButtons[0]);

    // Error state from fetchPlanQuotas + Retry button
    expect(await screen.findByText('Quotas service unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Pro \(USD 29\/month\)/ })).toBeInTheDocument();
    });

    // Plan defaults to '' ("unchanged") and Save is disabled when nothing changed
    const planSelect = screen.getByLabelText('Subscription Tier (Feature Access)') as HTMLSelectElement;
    expect(planSelect.value).toBe('');
    const saveBtn = screen.getByRole('button', { name: 'Save Access' });
    expect(saveBtn).toBeDisabled();

    // Role-only edit must send ONLY { role } and omit planId + isActive
    fireEvent.change(screen.getByLabelText('System Role'), {
      target: { value: 'regional_manager' },
    });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/users/u-pro', {
        role: 'regional_manager',
      });
    });

    // Switch immediately to User B before User A's 600ms close timer expires
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Access' })[1]);
    const modalB = await screen.findByRole('dialog');
    expect(within(modalB).getByText(/Peter Karanja/)).toBeInTheDocument();

    // Even after 700ms (past User A's 600ms timer), User B's modal stays open
    await new Promise(resolve => setTimeout(resolve, 700));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText(/Peter Karanja/)).toBeInTheDocument();
  });

  it('hides Edit Access button for non-admin users such as regional managers', async () => {
    useAppStore.setState({
      user: {
        id: 'rm-1',
        email: 'rm@example.org',
        firstName: 'Regional',
        lastName: 'Lead',
        role: 'regional_manager',
        planName: 'Pro',
        isFree: false,
      },
    });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-1',
            firstName: 'Sam',
            lastName: 'Otieno',
            email: 'sam@example.org',
            role: 'extension_officer',
            region: 'North',
            phone: '',
            isActive: false,
            planName: 'Free',
            isFree: true,
            lastLogin: null,
          },
        ],
      },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UserManagementPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Sam Otieno')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Access' })).not.toBeInTheDocument();
  });
});
