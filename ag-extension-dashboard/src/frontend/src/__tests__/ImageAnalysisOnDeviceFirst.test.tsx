import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { OfflineDiagnosisResult } from '@/services/edgePlantVisionClassifier';

const mocks = vi.hoisted(() => ({
  checkPhotoOnDevice: vi.fn(),
  analyzePlantImage: vi.fn(),
  queueSpecimenForAnalysis: vi.fn(),
}));
vi.mock('@/services/onDevicePhotoCheck', () => ({ checkPhotoOnDevice: mocks.checkPhotoOnDevice }));
vi.mock('@/api/diseaseService', () => ({ analyzePlantImage: mocks.analyzePlantImage }));
vi.mock('@/services/offlineDiagnosisQueue', () => ({ queueSpecimenForAnalysis: mocks.queueSpecimenForAnalysis }));
vi.mock('@/components/canvas-ui/DiseaseSaliencyCanvas', () => ({ DiseaseSaliencyCanvas: () => <div /> }));

import { ImageAnalysisTab } from '@/pages/diagnostics/ImageAnalysisTab';

const candidate = (condition: string, confidence: number) => ({
  condition, scientificName: '', crop: 'Bean', confidence, severity: 'not_assessed' as const, symptoms: [],
  culturalControl: [], biologicalControl: [], chemicalIntervention: '', modelLabel: condition,
});
const onDeviceResult: OfflineDiagnosisResult = {
  isOfflineInference: true,
  origin: 'onnx',
  modelVersion: 'mobilenetv3_small_100, field photos test',
  heuristicDisclaimer: 'On-device model test.',
  primaryDiagnosis: candidate('Bean rust', 0.93),
  alternatives: [candidate('Bean Angular Leaf Spot', 0.05)],
  metrics: {} as OfflineDiagnosisResult['metrics'],
  confidentEnough: true,
  analyzedAt: '2026-11-24T00:00:00Z',
};
const cloudAnswer = {
  success: true,
  data: {
    overallHealth: 'diseased', diseases: [], recommendations: ['Monitor field closely'], confidence: 0.8, reviewStatus: 'needs_expert_review',
    provenance: { evidenceStatus: 'no_verified_source', source: 'AI vision analysis', sourceUrl: null, sourceTimestamp: null, provider: null, model: null, generatedAt: '2026-11-24T00:00:00Z' },
  },
};

// jsdom loads no images: fire onload as soon as a source is set.
class LoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 100;
  height = 100;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

function renderTab() {
  render(
    <ImageAnalysisTab cropType="beans" setCropType={() => undefined} radiusClass="" btnClass="" t={key => key}
      addNotification={() => undefined} getSeverityColor={() => ''} />,
  );
  const input = document.getElementById('image-upload') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['leaf'], 'leaf.jpg', { type: 'image/jpeg' })] } });
}

beforeEach(() => {
  vi.stubGlobal('Image', LoadingImage);
  mocks.checkPhotoOnDevice.mockReset();
  mocks.analyzePlantImage.mockReset().mockResolvedValue(cloudAnswer);
  mocks.queueSpecimenForAnalysis.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('photo check runs the model on the phone first', () => {
  it('skips the online check when the phone is sure, and offers it', async () => {
    mocks.checkPhotoOnDevice.mockResolvedValue({ result: onDeviceResult, sure: true });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /check this photo/i }));
    expect(await screen.findByText('Checked on this phone')).toBeInTheDocument();
    expect(screen.getByText('Bean rust')).toBeInTheDocument();
    expect(mocks.checkPhotoOnDevice).toHaveBeenCalledWith(expect.stringMatching(/^data:/), 'beans');
    expect(mocks.analyzePlantImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /check with the online model/i }));
    await waitFor(() => expect(mocks.analyzePlantImage).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Monitor field closely/)).toBeInTheDocument();
  });

  it('asks the online model when the phone is not sure', async () => {
    mocks.checkPhotoOnDevice.mockResolvedValue({ result: { ...onDeviceResult, confidentEnough: false }, sure: false });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /check this photo/i }));
    await waitFor(() => expect(mocks.analyzePlantImage).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Checked on this phone')).not.toBeInTheDocument();
  });

  it("keeps the phone's answer on screen when the online check fails", async () => {
    mocks.checkPhotoOnDevice.mockResolvedValue({ result: { ...onDeviceResult, confidentEnough: false }, sure: false });
    mocks.analyzePlantImage.mockRejectedValue(new Error('offline'));
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /check this photo/i }));
    expect(await screen.findByText(/online check could not run/)).toBeInTheDocument();
  });

  it('asks the online model as before when there is no model on the phone', async () => {
    mocks.checkPhotoOnDevice.mockResolvedValue(null);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /check this photo/i }));
    await waitFor(() => expect(mocks.analyzePlantImage).toHaveBeenCalledTimes(1));
  });
});
