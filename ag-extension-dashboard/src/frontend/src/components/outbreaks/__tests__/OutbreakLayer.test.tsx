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
  Polygon: ({ children, positions }: { children?: React.ReactNode; positions?: Array<[number, number]> }) => (
    <div data-testid="dispersal-polygon" data-positions={JSON.stringify(positions)}>
      {children}
    </div>
  ),
}));

vi.mock('@/api/efficacyService', () => ({
  outbreakService: {
    getClusters: vi.fn(),
    getDispersalProjection: vi.fn(),
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
    (outbreakService.getClusters as any).mockResolvedValueOnce([
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

  it('models and renders atmospheric spore dispersal cone (CE-002) on demand', async () => {
    (outbreakService.getClusters as any).mockResolvedValueOnce([
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

    (outbreakService.getDispersalProjection as any).mockResolvedValueOnce({
      origin: { lat: -0.0463, lng: 37.6559 },
      targetCentroid: { lat: -0.02, lng: 37.68 },
      coneFootprint: [
        { lat: -0.0463, lng: 37.6559 },
        { lat: -0.03, lng: 37.67 },
        { lat: -0.02, lng: 37.68 },
        { lat: -0.025, lng: 37.69 },
        { lat: -0.04, lng: 37.67 },
        { lat: -0.0463, lng: 37.6559 },
      ],
      dispersionDistanceKm: 14.2,
      apertureDegrees: 35,
      viabilityScore: 0.88,
      riskLevel: 'HIGH',
      environmentalFactors: {
        windSpeedKmH: 18,
        windBearingDeg: 45,
        relativeHumidity: 80,
        temperatureC: 24,
        germinationIndex: 0.82,
      },
      modelProvenance: {
        model: 'Gaussian Plume Advection-Diffusion Dispersion Model',
        methodology: 'Pasquill-Gifford Stability Class D Parameterization',
        calculatedAt: '2026-09-16T22:00:00Z',
      },
    });

    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /outbreaks/i }));

    await waitFor(() => {
      expect(screen.getByText(/fall armyworm — Maize/i)).toBeInTheDocument();
    });

    const projectBtn = screen.getByRole('button', { name: /project spore plume/i });
    fireEvent.click(projectBtn);

    await waitFor(() => {
      expect(outbreakService.getDispersalProjection).toHaveBeenCalledWith(
        expect.objectContaining({
          centroid: { lat: -0.0463, lng: 37.6559 },
          crop: 'Maize',
          diseaseLabel: 'fall_armyworm',
        })
      );
      expect(screen.getByTestId('dispersal-polygon')).toBeInTheDocument();
      expect(screen.getByText(/Spore Dispersal Cone \(CE-002\)/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
      expect(screen.getByText(/14.2 km/i)).toBeInTheDocument();
    });

    // Clear Plume
    const clearBtn = screen.getByRole('button', { name: /clear plume/i });
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId('dispersal-polygon')).not.toBeInTheDocument();
  });
});
