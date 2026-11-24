import { useState } from 'react';
import toast from 'react-hot-toast';
import { analyzePlantImage } from '../../api/diseaseService';
import { queueSpecimenForAnalysis } from '@/services/offlineDiagnosisQueue';
import { checkPhotoOnDevice, type OnDeviceCheck } from '@/services/onDevicePhotoCheck';
import type { OfflineDiagnosisResult } from '@/services/edgePlantVisionClassifier';
import type { OnDeviceReason } from '@/components/edgeVision/OnDevicePhotoResult';
import { useLanguage } from '@/lib/LanguageContext';
import { shrinkForVision } from '@/lib/visionPhoto';
import type { ImageAnalysisData } from './ImageAnalysisTab';

/** The chosen photo as a data URL, shrunk for the online check (see visionPhoto.ts). */
function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const rawResult = (e.target?.result as string) || '';
      void shrinkForVision(rawResult).then(resolve);
    };
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

/** The photo as base64 without its data-URL prefix, the form the online check takes. */
function base64Of(dataUrl: string): string {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

/**
 * The photo check: the model on this phone first, then the online model when the phone is not
 * sure, when there is no model on the phone, or when the person asks for it. Offline, the photo
 * is queued for the online check and the phone's answer (if any) is shown meanwhile.
 */
export function usePhotoCheck(cropType: string, addNotification: (notification: { type: string; message: string }) => void) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisData | null>(null);
  // The answer from the model on this phone, while no online answer replaces it.
  const [onDevice, setOnDevice] = useState<{ result: OfflineDiagnosisResult; reason: OnDeviceReason } | null>(null);
  const { t } = useLanguage();

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = e => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  /** Sends the photo to the online check; if that fails, the phone's answer (when there is one) stays on screen. */
  const runOnlineCheck = async (imageData: string, local: OnDeviceCheck | null) => {
    const keepLocal = () => { if (local) setOnDevice({ result: local.result, reason: 'online-failed' }); };
    try {
      const res = await analyzePlantImage(imageData, cropType || undefined);
      if (res.success) {
        setOnDevice(null);
        setImageAnalysis(res.data);
        if (res.data.recommendations.includes('Analysis was unavailable; do not treat this as a diagnosis')) {
          addNotification({ type: 'error', message: 'Plant image analysis is unavailable. No diagnosis was generated.' });
        } else {
          toast.success('Plant disease analysis completed!');
        }
      } else {
        keepLocal();
        addNotification({
          type: 'error',
          message: 'The analysis service could not process this image. No diagnosis was generated, so please try again.',
        });
      }
    } catch (error: unknown) {
      console.error('Image analysis error:', error);
      keepLocal();
      const status = (error as { response?: { status?: number } })?.response?.status;
      addNotification({
        type: 'error',
        message: status === 413
          ? 'Image file is too large for the analysis server. Please select a smaller photo.'
          : 'Could not reach the analysis service. No diagnosis was generated.',
      });
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzingImage(true);
    setImageAnalysis(null);
    setOfflineQueued(false);
    setOnDevice(null);

    try {
      const dataUrl = await processImageFile(selectedImage);
      const imageData = base64Of(dataUrl);
      // The phone's own model first: when it is sure, the online call (and its cost) is skipped.
      const local = await checkPhotoOnDevice(dataUrl, cropType);

      if (!navigator.onLine) {
        queueSpecimenForAnalysis(imageData, cropType || undefined);
        setOfflineQueued(true);
        if (local) setOnDevice({ result: local.result, reason: 'offline' });
        toast('No connection — specimen queued for analysis when you are back online.');
        return;
      }
      if (local?.sure) {
        setOnDevice({ result: local.result, reason: 'sure' });
        toast.success(t('on_device_toast', { defaultValue: 'Checked on this phone.' }));
        return;
      }
      await runOnlineCheck(imageData, local);
    } catch (error: unknown) {
      console.error('Photo check error:', error);
      addNotification({ type: 'error', message: 'The photo could not be read. Please choose it again.' });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  /** The person asks for the online check after seeing the phone's answer. */
  const handleOnlineCheck = async () => {
    if (!selectedImage || !onDevice) return;
    setIsAnalyzingImage(true);
    try {
      const dataUrl = await processImageFile(selectedImage);
      await runOnlineCheck(base64Of(dataUrl), { result: onDevice.result, sure: false });
    } catch (error: unknown) {
      console.error('Photo check error:', error);
      addNotification({ type: 'error', message: 'The photo could not be read. Please choose it again.' });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setOnDevice(null);
  };

  return {
    selectedImage, imagePreview, isAnalyzingImage, offlineQueued, imageAnalysis, onDevice,
    handleImageSelect, handleAnalyzeImage, handleOnlineCheck, removeImage,
  };
}
