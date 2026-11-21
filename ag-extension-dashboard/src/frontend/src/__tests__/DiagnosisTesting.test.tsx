import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { DiagnosisTestingTab } from '../components/diagnosisTests/DiagnosisTestingTab';
import { DiagnosisValidationNote } from '../components/diagnosisTests/DiagnosisValidationNote';
import { LabelPhotoForm } from '../components/diagnosisTests/LabelPhotoForm';
import { classState } from '../components/diagnosisTests/diagnosisTestsApi';

const overview = {
  thresholds: { minSamples: 20, minAccuracy: 0.85, maxPhotosPerRun: 400 },
  runs: [{ id: 'r1', status: 'finished', total: 45, done: 45, correct: 40, startedAt: '2026-11-20T10:00:00Z', finishedAt: '2026-11-20T10:20:00Z' }],
  classes: [
    { crop: 'maize', label: 'northern leaf blight', photos: 25, fieldConfirmed: 5, tested: 25, correct: 24 },
    { crop: 'maize', label: 'common rust', photos: 20, fieldConfirmed: 0, tested: 20, correct: 12 },
    { crop: 'cassava', label: 'mosaic', photos: 4, fieldConfirmed: 4, tested: null, correct: null },
  ],
};

describe('testing photo diagnosis', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    useAppStore.setState({ user: { id: 'm1', role: 'regional_manager' } as never });
  });

  it('shows which crops and problems farmers see as tested', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve({ data: { data: url.endsWith('/mistakes')
      ? [{ imageId: 'i1', crop: 'maize', label: 'common rust', predicted: 'Gray leaf spot', url: '/f/1.jpg' }]
      : overview } }));
    render(<DiagnosisTestingTab />);
    expect(await screen.findByText('northern leaf blight')).toBeInTheDocument();
    expect(screen.getByText('24/25 (96%)')).toBeInTheDocument();
    expect(screen.getByText('Shown to farmers as tested')).toBeInTheDocument();
    expect(screen.getByText('Too many wrong: officer confirms')).toBeInTheDocument();
    expect(screen.getByText('Needs more photos')).toBeInTheDocument();
    expect(await screen.findByText('Said: Gray leaf spot')).toBeInTheDocument();
  });

  it('starts a run', async () => {
    api.get.mockResolvedValue({ data: { data: { ...overview, runs: [] } } });
    api.post.mockResolvedValue({ data: { data: { id: 'r2', total: 49 } } });
    render(<DiagnosisTestingTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run the test' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/diagnosis-tests/runs'));
  });

  it('counts a class with too few photos as needing photos, not as tested', () => {
    expect(classState({ crop: 'c', label: 'l', photos: 5, fieldConfirmed: 0, tested: 5, correct: 5 }, 20, 0.85)).toBe('needs_photos');
  });

  it('tells the farmer plainly when a diagnosis is untested', () => {
    render(<DiagnosisValidationNote validation={{ status: 'not_tested', samples: 0, accuracy: null }} />);
    expect(screen.getByRole('note')).toHaveTextContent('Not yet tested on labelled photos');
  });

  it('lets an officer record what a farmer’s photo shows', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<LabelPhotoForm uploadId="u1" />);
    fireEvent.change(screen.getByLabelText('Crop'), { target: { value: 'Maize' } });
    fireEvent.change(screen.getByLabelText('Problem you confirmed in the field (or healthy)'), { target: { value: 'Fall armyworm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/diagnosis-tests/images', { uploadId: 'u1', crop: 'Maize', label: 'Fall armyworm' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
  });
});
