import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OutbreakLayer } from '../OutbreakLayer';
import { outbreakService } from '@/api/efficacyService';

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ children, center }: { children?: React.ReactNode; center?: [number, number] }) => (
    <div data-testid="circle-marker" data-center={JSON.stringify(center)}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-popup">{children}</div>,
}));

vi.mock('@/api/efficacyService', () => ({
  outbreakService: {
    getClusters: vi.fn(),
  },
}));

describe('OutbreakLayer Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <OutbreakLayer />
      </QueryClientProvider>
    );

  it('renders Outbreaks toggle button initially unpressed', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /outbreaks/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('fetches and displays clusters when toggled on', async () => {
    vi.mocked(outbreakService.getClusters).mockResolvedValueOnce([
      {
        district: 'Meru',
        crop: 'Maize',
        diseaseLabel: 'fall_armyworm',
        caseCount: 8,
        distinctFarmers: 5,
        firstSeen: '2026-09-01T00:00:00Z',
        lastSeen: '2026-09-15T00:00:00Z',
        centroid: { lat: -0.0463, lng: 37.6559 },
        differentialPrivacyApplied: true,
      },
    ]);

    renderComponent();
    const toggleBtn = screen.getByRole('button', { name: /outbreaks/i });
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => {
      expect(screen.getByText(/fall armyworm — Maize/i)).toBeInTheDocument();
      expect(screen.getByText(/8 cases · 5 farms · Meru/i)).toBeInTheDocument();
      expect(screen.getByText(/ε=1.0 DP/i)).toBeInTheDocument();
    });
  });

  it('shows where reports are, with no spread projection', async () => {
    vi.mocked(outbreakService.getClusters).mockResolvedValueOnce([
      {
        district: 'Meru', crop: 'Maize', diseaseLabel: 'fall_armyworm', caseCount: 8, distinctFarmers: 5,
        firstSeen: '2026-09-01T00:00:00Z', lastSeen: '2026-09-15T00:00:00Z', centroid: { lat: -0.0463, lng: 37.6559 },
      },
    ]);
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /outbreaks/i }));
    await waitFor(() => expect(screen.getByText(/fall armyworm — Maize/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /plume|dispersal/i })).toBeNull();
  });
});
