import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SymptomDiagnosisTab } from '../pages/diagnostics/SymptomDiagnosisTab';
import { diagnoseFromSymptoms } from '../api/diseaseService';

vi.mock('../api/diseaseService', () => ({ diagnoseFromSymptoms: vi.fn() }));

describe('symptom evidence labeling', () => {
  it('does not call an unverified heuristic result verified even when reviewStatus is ready', async () => {
    vi.mocked(diagnoseFromSymptoms).mockResolvedValue({
      success: true,
      data: [{
        disease: 'Rust', confidence: 0.9, reviewStatus: 'ready',
        provenance: { evidenceStatus: 'no_verified_source', source: 'heuristic', sourceUrl: null,
          sourceTimestamp: null, provider: null, model: null, generatedAt: '2026-01-01' },
        safetyNotice: 'Consult an expert', severity: 'severe', description: 'Spots',
        symptoms: ['spots'], treatment: [], prevention: [],
      }],
    });
    render(<SymptomDiagnosisTab cropType="maize" setCropType={vi.fn()} radiusClass="" btnClass=""
      t={key => key} addNotification={vi.fn()} onViewDiseaseInfo={vi.fn()} getSeverityColor={() => ''} />);
    fireEvent.click(screen.getByRole('button', { name: /Dark dead spots/ }));
    fireEvent.click(screen.getByRole('button', { name: /Check symptoms/i }));
    expect(await screen.findByText('Not checked by an expert yet')).toBeInTheDocument();
    expect(screen.getByText('Might be Rust')).toBeInTheDocument();
    // A symptom check's "severity" is how well the signs matched, not how serious the disease is.
    expect(screen.queryByText(/How serious/)).not.toBeInTheDocument();
    expect(screen.queryByText('From a checked source')).not.toBeInTheDocument();
  });
});
