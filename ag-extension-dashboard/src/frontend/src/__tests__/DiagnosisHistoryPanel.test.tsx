import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosisHistoryPanel } from '../pages/diagnostics/DiagnosisHistoryPanel';
import { getDiagnosisHistory } from '../api/diseaseService';

vi.mock('../api/diseaseService', () => ({ getDiagnosisHistory: vi.fn() }));

const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DiagnosisHistoryPanel />
    </QueryClientProvider>
  );
};

describe('diagnosis history panel', () => {
  it('lists the caller diagnoses with match strength, crop, district and source', async () => {
    vi.mocked(getDiagnosisHistory).mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'd1',
          farmerId: null,
          district: 'Nakuru',
          crop: 'maize',
          diseaseLabel: 'Fall armyworm',
          confidence: 0.92,
          source: 'extension_tool',
          createdAt: '2026-11-18T09:30:00.000Z',
        }],
        limit: 20,
        offset: 0,
      },
    });

    renderPanel();

    expect(await screen.findByText('Fall armyworm')).toBeInTheDocument();
    expect(screen.getByText(/92\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/maize · Nakuru/)).toBeInTheDocument();
    expect(screen.getByText(/extension tool/)).toBeInTheDocument();
  });

  it('states that nothing is recorded yet when the history is empty', async () => {
    vi.mocked(getDiagnosisHistory).mockResolvedValue({
      success: true,
      data: { items: [], limit: 20, offset: 0 },
    });

    renderPanel();

    expect(await screen.findByText(/No diagnoses recorded yet/)).toBeInTheDocument();
  });
});
