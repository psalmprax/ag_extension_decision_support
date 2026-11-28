import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fieldRecordsService } from '@/api/fieldRecordsService';
import { FieldSatellitePanel } from '../records/FieldSatellitePanel';

vi.mock('@/api/fieldRecordsService', () => ({ fieldRecordsService: { satellite: vi.fn() } }));

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('the field’s satellite record', () => {
  beforeEach(() => vi.clearAllMocks());

  it('states each fact with its source', async () => {
    vi.mocked(fieldRecordsService.satellite).mockResolvedValue({
      rainfall: { month: '2026-10', rainMm: 20, averageMm: 60, baselineYears: 10, percentOfAverage: 33, source: 'CHIRPS, Digital Earth Africa' },
      greenness: { month: '2026-10', ndvi: 0.31, stdAnomaly: -1.4, clearObservations: 4, source: 'NDVI anomaly, Digital Earth Africa' },
      floodHistory: { frequency: 0, wetObservations: 0, clearObservations: 412, source: 'WOfS all-time summary, Digital Earth Africa' },
      cropland2019: { cropland: true, probabilityPct: 87, source: 'Cropland extent 2019, Digital Earth Africa' },
      worldCereal2021: { temporaryCrops: true, maizeMainSeason: null, maizeConfidencePct: null, source: 'ESA WorldCereal 2021, Digital Earth Africa' },
    });
    wrap(<FieldSatellitePanel fieldId="f1" hasLocation />);
    expect(await screen.findByText(/20 mm in October 2026: 33% of the average for that month over 10 earlier years \(60 mm\)\./)).toBeInTheDocument();
    expect(screen.getByText(/1\.4 standard deviations below the 1984–2020 normal/)).toBeInTheDocument();
    expect(screen.getByText(/Not seen under water in 412 clear satellite views since 1984\./)).toBeInTheDocument();
    expect(screen.getByText(/Yes \(87% probability\)\./)).toBeInTheDocument();
    expect(screen.getByText(/Seasonal crops: Yes\. Maize, main season: No answer here\./)).toBeInTheDocument();
    expect(screen.getByText('CHIRPS, Digital Earth Africa')).toBeInTheDocument();
  });

  it('asks for a location before looking anything up', () => {
    wrap(<FieldSatellitePanel fieldId="f1" hasLocation={false} />);
    expect(screen.getByText(/Add the field’s location/)).toBeInTheDocument();
    expect(fieldRecordsService.satellite).not.toHaveBeenCalled();
  });
});
