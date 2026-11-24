/**
 * The photo check's first step: the released on-device disease model.
 *
 * Every online photo check costs a call to the AI vision service (counted against the plan's
 * vision allowance). When the phone's own model is sure enough (see confidentThreshold in
 * edgeModelManifest.ts), its answer is shown and the online call is skipped; the person can
 * still ask for the online check. Otherwise the photo goes online as before.
 */
import { diagnosePlantOffline, type OfflineDiagnosisResult } from './edgePlantVisionClassifier';

export interface OnDeviceCheck {
  result: OfflineDiagnosisResult;
  /** The answer is sure enough to show without the online check. */
  sure: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The photo could not be read on this device.'));
    image.src = src;
  });
}

/**
 * The on-device model's answer for a photo (a data URL), or null when no released model gave
 * one: none installed, the crop is one it was not trained on, no leaf was found, or it was not
 * sure enough to answer at all. The colour check alone is never returned here.
 */
export async function checkPhotoOnDevice(dataUrl: string, crop?: string): Promise<OnDeviceCheck | null> {
  try {
    const result = await diagnosePlantOffline(await loadImage(dataUrl), crop?.trim() || undefined);
    if (result.origin !== 'onnx') return null;
    return { result, sure: result.confidentEnough === true };
  } catch (error) {
    console.warn('On-device photo check failed; the online check will run.', error);
    return null;
  }
}
