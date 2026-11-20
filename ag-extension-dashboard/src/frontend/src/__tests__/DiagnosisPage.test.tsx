import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/lib/LanguageContext';
import { DiagnosisPage } from '../pages/DiagnosisPage';

vi.mock('@/components/canvas-ui/AgroEcosystemCanvasScrubber', () => ({
  AgroEcosystemCanvasScrubber: () => <div data-testid="agro-scrubber" />,
}));


vi.mock('@/components/canvas-ui/DiseaseSaliencyCanvas', () => ({
  DiseaseSaliencyCanvas: () => <div data-testid="disease-saliency" />,
}));

vi.mock('@/api/diseaseService', () => ({
  getAllDiseases: vi.fn().mockResolvedValue({ success: true, data: ['Maize Rust', 'Fall Armyworm'] }),
  getDiseaseInfo: vi.fn().mockResolvedValue({ success: true, data: { disease: 'Maize Rust' } }),
  analyzePlantImage: vi.fn(),
  analyzeCropVideo: vi.fn(),
  MAX_DIAGNOSIS_VIDEO_BYTES: 30 * 1024 * 1024,
  diagnoseFromSymptoms: vi.fn(),
  getDiagnosisHistory: vi.fn().mockResolvedValue({ success: true, data: { items: [], limit: 20, offset: 0 } }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('DiagnosisPage Component', () => {
  it('renders the public diagnosis clinic and prominent back navigation', async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LanguageProvider>
              <DiagnosisPage />
            </LanguageProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    // Verify prominent Back to Landing Page navigation
    const backBtn = within(screen.getByRole('banner')).getByRole('link', {
      name: /Back to landing page/i,
    });
    expect(backBtn).toBeDefined();
    expect(backBtn.getAttribute('href')).toBe('/');

    // Verify clinic title and guarantees
    expect(screen.getByRole('heading', { level: 1, name: 'Disease diagnosis' })).toBeDefined();
    expect(screen.getByText(/confirm with an extension officer before you treat/i)).toBeDefined();

    // Verify diagnostic tabs
    for (const name of ['Leaf photo', 'Video', 'Describe symptoms', 'Soil', 'Disease library']) {
      expect(screen.getByRole('tab', { name })).toBeDefined();
    }
  });
});
