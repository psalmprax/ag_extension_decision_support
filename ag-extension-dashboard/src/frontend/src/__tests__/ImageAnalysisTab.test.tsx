import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisResultsHUD, type ImageAnalysisData } from '../pages/diagnostics/ImageAnalysisTab';

vi.mock('@/components/canvas-ui/DiseaseSaliencyCanvas', () => ({
  DiseaseSaliencyCanvas: () => <div data-testid="saliency-canvas" />,
}));

describe('ImageAnalysisTab Provenance Display', () => {
  const baseAnalysis: ImageAnalysisData = {
    overallHealth: 'diseased',
    diseases: [],
    recommendations: ['Monitor field closely'],
    confidence: 0.95,
    reviewStatus: 'ready',
    provenance: {
      evidenceStatus: 'verified_source',
      source: 'AI vision analysis via AIMixHub',
      sourceUrl: null,
      sourceTimestamp: null,
      provider: 'AIMixHub',
      model: 'gemini-2.5-flash',
      generatedAt: new Date().toISOString(),
    },
  };

  it('renders clean AIMixHub source without duplicating provider when already included in source', () => {
    render(
      <AnalysisResultsHUD
        imageAnalysis={baseAnalysis}
        imagePreview={null}
        offlineQueued={false}
        getSeverityColor={() => 'text-red-400'}
      />
    );

    const sourceEl = screen.getByText(/Source:/i);
    expect(sourceEl).toHaveTextContent('Source: AI vision analysis via AIMixHub');
    // Ensure it does not duplicate as "Source: AI vision analysis via AIMixHub (AIMixHub)"
    expect(sourceEl.textContent?.trim()).toBe('Source: AI vision analysis via AIMixHub');
  });

  it('appends provider in parentheses when source does not already mention provider', () => {
    const analysisWithGenericSource: ImageAnalysisData = {
      ...baseAnalysis,
      provenance: {
        ...baseAnalysis.provenance,
        source: 'AI vision analysis',
        provider: 'AIMixHub',
      },
    };

    render(
      <AnalysisResultsHUD
        imageAnalysis={analysisWithGenericSource}
        imagePreview={null}
        offlineQueued={false}
        getSeverityColor={() => 'text-red-400'}
      />
    );

    const sourceEl = screen.getByText(/Source:/i);
    expect(sourceEl).toHaveTextContent('Source: AI vision analysis (AIMixHub)');
  });
});
