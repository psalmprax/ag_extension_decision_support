import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFarmers } from '@/api/farmerService';
import { useAppQueries } from '@/hooks/useAppQueries';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { useAppStore, type User } from '@/store/useAppStore';
import { DEMO_FARMERS } from '@/demo';

vi.mock('@/api/farmerService', () => ({ fetchFarmers: vi.fn() }));
vi.mock('@/lib/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

const admin: User = {
  id: 'real-admin', firstName: 'Real', lastName: 'Admin', email: 'admin@example.test', role: 'admin',
};
const farmer = {
  id: 'real-farmer', firstName: 'Live', lastName: 'Client', region: 'Central', crops: ['Maize'], farmSize: 2,
};

function Portfolio() {
  const { effectiveFarmers } = useAppQueries('portfolio', '');
  return <PortfolioPage
    effectiveFarmers={effectiveFarmers}
    selectedFarmers={new Set()}
    handleSelectFarmer={vi.fn()}
    handleOpenFarmerDetail={vi.fn()}
    showBulkSmsComposer={false}
    setShowBulkSmsComposer={vi.fn()}
    bulkSmsMessage=""
    setBulkSmsMessage={vi.fn()}
    handleBulkSMS={vi.fn()}
    handleBulkExport={vi.fn()}
    handleBulkDelete={vi.fn()}
    setSelectedFarmers={vi.fn()}
  />;
}

function renderPortfolio(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}><Portfolio /></QueryClientProvider>);
}

describe('Client Portfolio demo isolation', () => {
  beforeEach(() => {
    vi.mocked(fetchFarmers).mockReset();
    useAppStore.setState({ user: admin, isDemo: false, farmers: [] });
    vi.mocked(fetchFarmers).mockResolvedValue({
      success: true, data: { farmers: [farmer], total: 1 },
    });
  });

  it('ignores a stale persisted demo flag and sample store farmers for a real admin', async () => {
    useAppStore.setState({ isDemo: true, farmers: DEMO_FARMERS });
    renderPortfolio();
    expect(await screen.findByText('Live Client')).toBeInTheDocument();
    expect(fetchFarmers).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sandbox Mode:')).not.toBeInTheDocument();
    expect(screen.queryByText(`${DEMO_FARMERS[0].firstName} ${DEMO_FARMERS[0].lastName}`)).not.toBeInTheDocument();
  });

  it('does not replace an empty live admin portfolio with samples', async () => {
    vi.mocked(fetchFarmers).mockResolvedValue({ success: true, data: { farmers: [], total: 0 } });
    useAppStore.setState({ isDemo: true, farmers: DEMO_FARMERS });
    renderPortfolio();
    await waitFor(() => expect(fetchFarmers).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Sandbox Mode:')).not.toBeInTheDocument();
    expect(screen.queryByText(`${DEMO_FARMERS[0].firstName} ${DEMO_FARMERS[0].lastName}`)).not.toBeInTheDocument();
  });

  it('filters synthetic and explicitly demo-marked farmers from a live response', async () => {
    const records = [
      farmer,
      { ...farmer, id: 'demo-farmer-1', firstName: 'Synthetic' },
      { ...farmer, id: 'seeded-demo-id', firstName: 'Seeded', isDemo: true },
    ];
    vi.mocked(fetchFarmers).mockResolvedValue({ success: true, data: { farmers: records, total: records.length } });
    renderPortfolio();
    expect(await screen.findByText('Live Client')).toBeInTheDocument();
    expect(screen.queryByText('Synthetic Client')).not.toBeInTheDocument();
    expect(screen.queryByText('Seeded Client')).not.toBeInTheDocument();
  });

  it('shows sample farmers only for the actual demo account', () => {
    useAppStore.setState({ user: { ...admin, id: 'demo-user', email: 'demo@agridemo.com' }, isDemo: true });
    renderPortfolio();
    expect(screen.getByText('Sandbox Mode:')).toBeInTheDocument();
    expect(screen.getByText(`${DEMO_FARMERS[0].firstName} ${DEMO_FARMERS[0].lastName}`)).toBeInTheDocument();
    expect(fetchFarmers).not.toHaveBeenCalled();
  });

  it('does not reuse another account’s farmer query cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['farmers', 'previous-user', false], {
      success: true, data: { farmers: [{ ...farmer, firstName: 'Previous' }], total: 1 },
    });
    renderPortfolio(client);
    expect(await screen.findByText('Live Client')).toBeInTheDocument();
    expect(screen.queryByText('Previous Client')).not.toBeInTheDocument();
  });

  it('clears demo state and pending data when a real admin signs in', () => {
    useAppStore.setState({
      user: { ...admin, id: 'demo-user', email: 'demo@agridemo.com' }, isDemo: true,
      farmers: DEMO_FARMERS, pendingSMS: { phone: '', message: 'Sample message' },
    });
    useAppStore.getState().setUser(admin);
    expect(useAppStore.getState()).toMatchObject({
      user: admin, isDemo: false, farmers: [], visits: [], notifications: [], pendingSMS: null,
    });
  });

  it('repairs persisted demo mode before map and other store consumers use it', async () => {
    localStorage.setItem('ag-extension-storage', JSON.stringify({
      state: { user: admin, isDemo: true }, version: 0,
    }));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().isDemo).toBe(false);
    renderPortfolio();
    expect(await screen.findByText('Live Client')).toBeInTheDocument();
    expect(screen.queryByText('Sandbox Mode:')).not.toBeInTheDocument();
  });
});
