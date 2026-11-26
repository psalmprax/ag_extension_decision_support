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

  it('clearly marks fallback results as unavailable instead of displaying a confidence score', () => {
    const unavailableAnalysis: ImageAnalysisData = {
      ...baseAnalysis,
      overallHealth: 'unknown',
      diseases: [],
      recommendations: [
        'Analysis was unavailable; do not treat this as a diagnosis',
        'Provide clear photos of affected plant parts for another attempt',
      ],
      confidence: 0,
      reviewStatus: 'needs_expert_review',
      provenance: {
        ...baseAnalysis.provenance,
        evidenceStatus: 'no_verified_source',
        source: 'AI vision analysis unavailable; no verified source',
        provider: null,
        model: null,
      },
    };

    render(
      <AnalysisResultsHUD
        imageAnalysis={unavailableAnalysis}
        imagePreview={null}
        offlineQueued={false}
        getSeverityColor={() => 'text-red-400'}
      />
    );

    expect(screen.getByText('We could not check this photo, so there is no result. Try again, or ask your officer.')).toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('shows stress observations and next steps without presenting model confidence as a confirmed diagnosis', () => {
    render(
      <AnalysisResultsHUD
        imageAnalysis={{
          ...baseAnalysis,
          overallHealth: 'stressed',
          confidence: 0.85,
          reviewStatus: 'needs_expert_review',
          provenance: { ...baseAnalysis.provenance, evidenceStatus: 'no_verified_source' },
          nutrientDeficiencies: ['Possible nitrogen deficiency'],
          recommendations: ['Check soil moisture and drainage before changing irrigation.'],
        }}
        imagePreview="data:image/png;base64,test"
        offlineQueued={false}
        getSeverityColor={() => 'text-red-400'}
      />
    );

    expect(screen.getByText('Plant health: stressed')).toBeInTheDocument();
    // How sure the check is, in words first: a bare percentage reads like a lab result.
    expect(screen.getByText('How sure: fairly sure (85%)')).toBeInTheDocument();
    expect(screen.getByText(/not a confirmed diagnosis\. Ask your officer or a local expert to confirm before you treat/)).toBeInTheDocument();
    expect(screen.getByText('Possible nutrient shortage (not confirmed)')).toBeInTheDocument();
    expect(screen.getByText('Possible nitrogen deficiency')).toBeInTheDocument();
    expect(screen.getByText('Check soil moisture and drainage before changing irrigation.')).toBeInTheDocument();
  });

  it('shows disease descriptions and reported symptoms rather than only a match score', () => {
    render(
      <AnalysisResultsHUD
        imageAnalysis={{
          ...baseAnalysis,
          diseases: [{
            disease: 'Rust', confidence: 0.8, severity: 'moderate',
            reviewStatus: 'needs_expert_review', provenance: baseAnalysis.provenance,
            description: 'Orange pustules may be consistent with rust.',
            symptoms: ['Orange spots on leaf undersides'],
            treatment: [], prevention: [], safetyNotice: 'Confirm with a local expert.',
          }],
        }}
        imagePreview={null}
        offlineQueued={false}
        getSeverityColor={() => 'text-red-400'}
      />
    );

    expect(screen.getByText('Might be Rust')).toBeInTheDocument();
    expect(screen.getByText('Orange pustules may be consistent with rust.')).toBeInTheDocument();
    expect(screen.getByText('Signs: Orange spots on leaf undersides')).toBeInTheDocument();
    expect(screen.queryByText('Possible nutrient shortage (not confirmed)')).not.toBeInTheDocument();
  });

  it('keeps disease results visible when the symptom list is malformed', () => {
    render(
      <AnalysisResultsHUD
        imageAnalysis={{
          ...baseAnalysis,
          diseases: [{
            disease: 'Rust', confidence: 0.8, severity: 'moderate',
            reviewStatus: 'needs_expert_review', provenance: baseAnalysis.provenance,
            description: 'Orange pustules may be consistent with rust.',
            symptoms: null as unknown as string[],
            treatment: [], prevention: [], safetyNotice: 'Confirm with a local expert.',
          }],
        }}
        imagePreview={null}
        offlineQueued={false}
        getSeverityColor={() => 'text-red-400'}
      />
    );

    expect(screen.getByText('Might be Rust')).toBeInTheDocument();
    expect(screen.getByText('Orange pustules may be consistent with rust.')).toBeInTheDocument();
    expect(screen.queryByText(/Signs:/)).not.toBeInTheDocument();
  });
});
