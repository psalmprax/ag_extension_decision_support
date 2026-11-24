import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const diagnosePlantOffline = vi.hoisted(() => vi.fn());
vi.mock('@/services/edgePlantVisionClassifier', () => ({ diagnosePlantOffline }));

import { checkPhotoOnDevice } from '@/services/onDevicePhotoCheck';

class LoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    setTimeout(() => (value.startsWith('data:') ? this.onload?.() : this.onerror?.()), 0);
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', LoadingImage);
  diagnosePlantOffline.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('checkPhotoOnDevice', () => {
  it("returns the model's answer and whether it is sure enough to skip the online check", async () => {
    diagnosePlantOffline.mockResolvedValue({ origin: 'onnx', confidentEnough: true });
    expect(await checkPhotoOnDevice('data:image/jpeg;base64,AA', ' Maize ')).toEqual({ result: { origin: 'onnx', confidentEnough: true }, sure: true });
    expect(diagnosePlantOffline).toHaveBeenCalledWith(expect.any(LoadingImage), 'Maize');
  });

  it('never returns the colour check, which is not a diagnosis', async () => {
    diagnosePlantOffline.mockResolvedValue({ origin: 'heuristic' });
    expect(await checkPhotoOnDevice('data:image/jpeg;base64,AA')).toBeNull();
  });

  it('gives none when the photo cannot be read, so the online check runs', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await checkPhotoOnDevice('not-a-photo')).toBeNull();
    expect(diagnosePlantOffline).not.toHaveBeenCalled();
  });
});
