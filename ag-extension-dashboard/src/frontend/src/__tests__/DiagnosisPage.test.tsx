import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/lib/LanguageContext';
import { DiagnosisPage } from '../pages/DiagnosisPage';

vi.mock('@/components/canvas-ui/AgroEcosystemCanvasScrubber', () => ({
  AgroEcosystemCanvasScrubber: () => <div data-testid="agro-scrubber" />,
}));

vi.mock('@/components/canvasui/LiquidToggleSwitch', () => ({
  LiquidToggleSwitch: () => <div data-testid="liquid-toggle" />,
}));

vi.mock('@/components/canvas-ui/DiseaseSaliencyCanvas', () => ({
  DiseaseSaliencyCanvas: () => <div data-testid="disease-saliency" />,
}));

vi.mock('@/api/diseaseService', () => ({
  getAllDiseases: vi.fn().mockResolvedValue({ success: true, data: ['Maize Rust', 'Fall Armyworm'] }),
  getDiseaseInfo: vi.fn().mockResolvedValue({ success: true, data: { disease: 'Maize Rust' } }),
  analyzePlantImage: vi.fn(),
  diagnoseFromSymptoms: vi.fn(),
}));

describe('DiagnosisPage Component', () => {
  it('renders the public diagnosis clinic and prominent back navigation', () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <DiagnosisPage />
        </LanguageProvider>
      </MemoryRouter>
    );

    // Verify prominent Back to Landing Page navigation
    const backBtn = screen.getByRole('link', { name: /Back to Landing Page/i });
    expect(backBtn).toBeDefined();
    expect(backBtn.getAttribute('href')).toBe('/');

    // Verify clinic title and guarantees
    expect(screen.getByText(/Instant Crop Disease & Leaf Pathology Doctor/i)).toBeDefined();
    expect(screen.getByText(/On-Device AI/i)).toBeDefined();

    // Verify diagnostic tabs
    expect(screen.getByText(/Leaf Image Analysis/i)).toBeDefined();
    expect(screen.getByText(/Symptom Inference/i)).toBeDefined();
    expect(screen.getByText(/Soil Diagnostics/i)).toBeDefined();
    expect(screen.getByText(/Pathology Library/i)).toBeDefined();
  });
});
