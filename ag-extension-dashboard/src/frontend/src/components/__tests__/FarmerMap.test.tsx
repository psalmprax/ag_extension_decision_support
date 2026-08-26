import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FarmerMap } from '../FarmerMap';
import { LanguageProvider } from '../../lib/LanguageContext';

// Mock Leaflet and React-Leaflet for unit test environment
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => (
    <div data-testid="map-container" style={style} className={`leaflet-container ${className || ''}`}>
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution }: { url?: string; attribution?: string }) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution} />
  ),
  Marker: ({ position, children }: { position?: [number, number]; children?: React.ReactNode }) => (
    <div data-testid="map-marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-popup">{children}</div>,
  ZoomControl: () => <div data-testid="zoom-control" />,
  useMap: () => ({
    invalidateSize: vi.fn(),
    setView: vi.fn(),
    fitBounds: vi.fn(),
    getContainer: () => document.createElement('div'),
  }),
}));

vi.mock('@/components/outbreaks/OutbreakLayer', () => ({
  OutbreakLayer: () => <div data-testid="outbreak-layer" />,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

describe('FarmerMap Component - Unexpanded State', () => {
  it('renders unexpanded map container with default 400px height and children', () => {
    renderWithProviders(<FarmerMap />);

    const mapContainer = screen.getByTestId('map-container');
    expect(mapContainer).toBeDefined();
    expect(mapContainer.style.height).toBe('100%');
    expect(mapContainer.style.width).toBe('100%');

    // Controls & actions should be visible
    expect(screen.getByTitle(/Locate Current Position/i)).toBeDefined();
    expect(screen.getByTitle(/Search Farmers/i)).toBeDefined();
    expect(screen.getByTitle(/Expand Map Fullscreen/i)).toBeDefined();

    // TileLayer should be rendered with OpenStreetMap by default
    const tileLayer = screen.getByTestId('tile-layer');
    expect(tileLayer).toBeDefined();
    expect(tileLayer.getAttribute('data-url')).toContain('openstreetmap.org');

    // OutbreakLayer should be present
    expect(screen.getByTestId('outbreak-layer')).toBeDefined();
  });

  it('renders with custom height prop when not expanded', () => {
    const { container } = renderWithProviders(<FarmerMap height="350px" />);

    const outerWrapper = container.firstChild as HTMLElement;
    expect(outerWrapper).toBeDefined();
    expect(outerWrapper.style.height).toBe('350px');
  });

  it('renders farmer markers from props', () => {
    const customFarmers = [
      {
        id: 'f-1',
        name: 'John Doe',
        lat: -0.5,
        lng: 37.0,
        crop: 'Maize',
        region: 'Nyeri',
        size: 5,
      },
      {
        id: 'f-2',
        name: 'Mary Jane',
        lat: -1.2,
        lng: 36.8,
        crop: 'Coffee',
        region: 'Kiambu',
        size: 3,
      },
    ];

    renderWithProviders(<FarmerMap farmers={customFarmers} />);

    const markers = screen.getAllByTestId('map-marker');
    expect(markers.length).toBe(2);
    expect(markers[0].getAttribute('data-position')).toBe('[-0.5,37]');
    expect(markers[1].getAttribute('data-position')).toBe('[-1.2,36.8]');
  });
});
