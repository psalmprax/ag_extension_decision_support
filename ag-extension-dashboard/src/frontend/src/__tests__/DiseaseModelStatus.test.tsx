import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiseaseModelStatus } from '@/components/edgeVision/DiseaseModelStatus';
import { resetEdgeModelManifest } from '@/services/edgeModelManifest';

const serve = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));

beforeEach(() => resetEdgeModelManifest());
afterEach(() => vi.unstubAllGlobals());

describe('the disease model line of an offline photo check', () => {
  it('says the latest model failed field testing, with its score and the score needed', async () => {
    serve({
      models: [],
      lastCandidate: {
        name: 'mobilenetv3_small_100, field photos 2026-11-24',
        fieldEvaluation: { dataset: 'test splits', images: 2246, top1Accuracy: 0.2, top3Accuracy: 0.4, cropTop1Accuracy: 0.8, evaluatedOn: '2026-11-24' },
      },
    });
    render(<DiseaseModelStatus model={null} confidence={0} />);
    expect(screen.getByText('None installed')).toBeInTheDocument();
    expect(await screen.findByText(/right disease in its top three for 40% of 2246 field photos, and 70% is needed/)).toBeInTheDocument();
  });

  it('says no model has passed yet when none was scored', async () => {
    serve({ models: [] });
    render(<DiseaseModelStatus model={null} confidence={0} />);
    expect(await screen.findByText('No disease model is installed yet.')).toBeInTheDocument();
  });

  it('names the model and its confidence when one ran', () => {
    render(<DiseaseModelStatus model="mobilenetv3_small_100" confidence={0.62} />);
    expect(screen.getByText('mobilenetv3_small_100')).toBeInTheDocument();
    expect(screen.getByText(/62%/)).toBeInTheDocument();
  });
});
