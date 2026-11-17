import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveActivityStream } from '@/components/LiveActivityStream';
import { DistributionPanels } from '@/components/dashboard/DistributionPanels';
import { useAppStore } from '@/store/useAppStore';
import { LanguageProvider } from '@/lib/LanguageContext';
import type { DashboardData } from '@/types/dashboard';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/client', () => ({
  default: {
    get: getMock,
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }: { children?: React.ReactNode; className?: string }) =>
      <div className={rest.className}>{children}</div>,
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderStream = async () => {
  render(<LanguageProvider><LiveActivityStream /></LanguageProvider>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
};

const DEMO_NAMES = ['Emmanuel Mwangi', 'Grace Wanjiku', 'Kiplagat Ruto'];
const t = (_key: string, fallback?: string) => fallback ?? _key;
const withFarmers: DashboardData = {
  overview: { totalFarmers: 3, activeConversations: 0, visitsThisMonth: 0, avgSatisfaction: 0, avgConversationsPerFarmer: 0 },
  trends: { farmersGrowth: 0, conversationsGrowth: 0, visitsGrowth: 0, satisfactionChange: 0 },
  crops: [{ name: 'Beans', count: 3 }],
  geography: [{ region: 'Kisumu', farmers: 3 }],
};

describe('real accounts never see sample dashboard data', () => {
  beforeEach(() => {
    getMock.mockReset();
    useAppStore.setState({ isDemo: false });
  });
  afterEach(() => useAppStore.setState({ isDemo: false }));

  it('shows the empty state, not demo farmers, when there is no triage activity', async () => {
    getMock.mockResolvedValue({ data: { success: true, data: [] } });
    await renderStream();
    expect(await screen.findByText('Awaiting events')).toBeInTheDocument();
    for (const name of DEMO_NAMES) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it('shows an error with retry, not demo farmers, when the feed fails', async () => {
    getMock.mockRejectedValue(new Error('network down'));
    await renderStream();
    expect(await screen.findByText('Feed unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    for (const name of DEMO_NAMES) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it('keeps the sample cards in the demo session', async () => {
    useAppStore.setState({ isDemo: true });
    await renderStream();
    await waitFor(() => expect(screen.getByText('Emmanuel Mwangi')).toBeInTheDocument());
    expect(getMock).not.toHaveBeenCalled();
  });

  it('shows empty crop and region panels instead of hardcoded samples', () => {
    render(<DistributionPanels dashboardData={undefined} t={t} cardClass="" />);
    expect(screen.getByText(/No crops recorded yet/)).toBeInTheDocument();
    expect(screen.getByText(/No farmers registered yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Uasin Gishu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SC-419/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sample')).not.toBeInTheDocument();
  });

  it('lists the account\'s own crops and regions when it has farmers', () => {
    render(<DistributionPanels dashboardData={withFarmers} t={t} cardClass="" />);
    expect(screen.getByText('Beans')).toBeInTheDocument();
    expect(screen.getByText('Kisumu')).toBeInTheDocument();
    expect(screen.queryByText(/No crops recorded yet/)).not.toBeInTheDocument();
  });
});
