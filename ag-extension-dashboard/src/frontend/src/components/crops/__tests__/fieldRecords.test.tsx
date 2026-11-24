import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fieldRecordsService, type SoilTest } from '@/api/fieldRecordsService';
import { SoilTestsPanel } from '../records/SoilTestsPanel';
import { FieldWeatherPanel } from '../records/FieldWeatherPanel';
import { FieldRecordsDialog } from '../records/FieldRecordsDialog';
import { organicChange, organicRows } from '../records/soilTestModel';
import type { Field } from '@/api/fieldService';

vi.mock('@/api/fieldRecordsService', () => ({
  fieldRecordsService: { soilTests: vi.fn(), addSoilTest: vi.fn(), deleteSoilTest: vi.fn(), weather: vi.fn() },
}));

const FIELD_ID = '22222222-2222-2222-2222-222222222222';
const test = (testedAt: string, values: Partial<SoilTest>): SoilTest => ({
  id: testedAt, fieldId: FIELD_ID, testedAt, labName: 'KALRO', sampleRef: null, ph: null, organicCarbonPct: null, organicMatterPct: null, nitrogenPpm: null, phosphorusPpm: null, potassiumPpm: null, ...values,
});

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('organic carbon over the years', () => {
  it('compares the first and latest test that report the value', () => {
    const rows = organicRows([test('2026-03-01', { organicCarbonPct: 1.8 }), test('2024-03-01', { organicCarbonPct: 1.5 }), test('2025-03-01', { ph: 6 })]);
    expect(organicChange(rows, 'organicCarbonPct')).toMatchObject({ change: 0.3, first: { date: '2024-03-01' }, last: { date: '2026-03-01' } });
    expect(organicChange(rows, 'organicMatterPct')).toBeNull();
  });

  it('shows the change and every result', async () => {
    vi.mocked(fieldRecordsService.soilTests).mockResolvedValue([test('2024-03-01', { organicCarbonPct: 1.5, ph: 5.9 }), test('2026-03-01', { organicCarbonPct: 1.8, ph: 6.1 })]);
    wrap(<SoilTestsPanel fieldId={FIELD_ID} fieldName="North" />);
    expect(await screen.findByText(/Organic carbon: 1.5% on .* to 1.8% on .* \(\+0.3 percentage points\)/)).toBeInTheDocument();
    expect(screen.getByText('All results (2)')).toBeInTheDocument();
  });
});

describe('adding a soil test', () => {
  beforeEach(() => {
    vi.mocked(fieldRecordsService.soilTests).mockResolvedValue([]);
    vi.mocked(fieldRecordsService.addSoilTest).mockReset().mockResolvedValue(test('2026-03-14', { ph: 6.1 }));
  });

  it('asks for at least one value before saving', async () => {
    wrap(<SoilTestsPanel fieldId={FIELD_ID} fieldName="North" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a lab result' }));
    fireEvent.change(screen.getByLabelText('Tested'), { target: { value: '2026-03-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter at least one value from the lab report.');
    expect(fieldRecordsService.addSoilTest).not.toHaveBeenCalled();
  });

  it('saves the values as the lab reported them', async () => {
    wrap(<SoilTestsPanel fieldId={FIELD_ID} fieldName="North" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a lab result' }));
    fireEvent.change(screen.getByLabelText('Tested'), { target: { value: '2026-03-14' } });
    fireEvent.change(screen.getByLabelText('pH'), { target: { value: '6,1' } });
    fireEvent.change(screen.getByLabelText('Organic carbon (%)'), { target: { value: '1.8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(() => expect(fieldRecordsService.addSoilTest).toHaveBeenCalled());
    expect(vi.mocked(fieldRecordsService.addSoilTest).mock.calls[0][1]).toMatchObject({ testedAt: '2026-03-14', ph: 6.1, organicCarbonPct: 1.8, organicMatterPct: null });
  });
});

describe('field weather', () => {
  it('gives the rainfall total, the average solar radiation and the last published day', async () => {
    vi.mocked(fieldRecordsService.weather).mockResolvedValue({
      source: 'NASA POWER', location: { latitude: -0.3031, longitude: 36.08 }, from: '2026-11-19', to: '2026-11-23', latestDate: '2026-11-20',
      units: { solar: 'MJ/m²/day', rain: 'mm/day' },
      days: [
        { date: '2026-11-19', solarMjM2: 20, rainMm: 3.5 },
        { date: '2026-11-20', solarMjM2: 18, rainMm: 1.5 },
        { date: '2026-11-21', solarMjM2: null, rainMm: null },
      ],
    });
    wrap(<FieldWeatherPanel fieldId={FIELD_ID} hasLocation />);
    expect(await screen.findByText('5 mm over 2 days with values')).toBeInTheDocument();
    expect(screen.getByText('Average 19 MJ/m² a day')).toBeInTheDocument();
    expect(screen.getByText(/Values up to .*a few days after it ends/)).toBeInTheDocument();
    expect(screen.getByText(/not a weather station on the farm/)).toBeInTheDocument();
  });

  it('asks for a location before looking anything up', () => {
    vi.mocked(fieldRecordsService.weather).mockClear();
    wrap(<FieldWeatherPanel fieldId={FIELD_ID} hasLocation={false} />);
    expect(screen.getByText(/map its boundary, to see the weather there/)).toBeInTheDocument();
    expect(fieldRecordsService.weather).not.toHaveBeenCalled();
  });

  it('passes on why NASA POWER data is missing', async () => {
    vi.mocked(fieldRecordsService.weather).mockRejectedValue({ response: { data: { error: 'NASA POWER could not be reached. Try again later.' } } });
    wrap(<FieldWeatherPanel fieldId={FIELD_ID} hasLocation />);
    expect(await screen.findByText('NASA POWER could not be reached. Try again later.')).toBeInTheDocument();
  });
});

describe('demo fields', () => {
  it('explain that they keep no records instead of asking the server', () => {
    vi.mocked(fieldRecordsService.soilTests).mockClear();
    wrap(<FieldRecordsDialog field={{ id: 'field-demo-1', name: 'Demo plot' } as Field} tab="soil" onTabChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/Demo fields have no saved records/)).toBeInTheDocument();
    expect(fieldRecordsService.soilTests).not.toHaveBeenCalled();
  });
});
