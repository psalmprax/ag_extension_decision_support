import React, { useState } from 'react';
import { Camera, FileImage, Loader2, CheckCircle, Zap } from 'lucide-react';
import {
  analyzePlantImage,
  type DiagnosticProvenance,
  type DiseaseDiagnosis,
  type DiagnosticReviewStatus,
} from '../../api/diseaseService';
import { classifyPlantImageOnDevice } from '@/services/offlineDiseaseClassifier';
import toast from 'react-hot-toast';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  t: (key: string) => string;
  addNotification: (notification: { type: string; message: string }) => void;
  getSeverityColor: (severity: string) => string;
}

export function ImageAnalysisTab({
  cropType,
  setCropType,
  radiusClass,
  btnClass,
  t,
  addNotification,
  getSeverityColor,
}: Props) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState<{
    overallHealth: string;
    diseases: DiseaseDiagnosis[];
    recommendations: string[];
    confidence: number;
    reviewStatus: DiagnosticReviewStatus;
    provenance: DiagnosticProvenance;
  } | null>(null);

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = e => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzingImage(true);
    setImageAnalysis(null);
    setIsOfflineMode(false);

    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(selectedImage);
      });
      const base64 = await base64Promise;
      const imageData = base64.split(',')[1];

      if (!navigator.onLine) {
        const offlineResult = await classifyPlantImageOnDevice(imageData, cropType || undefined);
        setImageAnalysis({ ...offlineResult, reviewStatus: 'ready' });
        setIsOfflineMode(true);
        toast.success('⚡ On-Device Edge AI Diagnosis Completed (Offline Mode)');
        return;
      }

      try {
        const res = await analyzePlantImage(imageData, cropType || undefined);
        if (res.success) {
          setImageAnalysis(res.data);
          toast.success('Plant disease analysis completed!');
        } else {
          const offlineResult = await classifyPlantImageOnDevice(imageData, cropType || undefined);
          setImageAnalysis({ ...offlineResult, reviewStatus: 'ready' });
          setIsOfflineMode(true);
          toast.success('⚡ Used On-Device Edge Classifier fallback');
        }
      } catch {
        const offlineResult = await classifyPlantImageOnDevice(imageData, cropType || undefined);
        setImageAnalysis({ ...offlineResult, reviewStatus: 'ready' });
        setIsOfflineMode(true);
        toast.success('⚡ Used On-Device Edge Classifier (Offline)');
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      addNotification({
        type: 'error',
        message: 'Failed to analyze image',
      });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Image Upload Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('disease_diagnosis_image_analysis')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Crop Type (Optional)
            </label>
            <input
              type="text"
              value={cropType}
              onChange={e => setCropType(e.target.value)}
              placeholder="e.g., maize, tomato, wheat"
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            />
          </div>

          {/* Image Upload */}
          <div
            className={`border-2 border-dashed border-gray-300 dark:border-gray-600 ${radiusClass} p-6 text-center`}
          >
            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Plant"
                  className={`max-w-full max-h-48 mx-auto ${radiusClass}`}
                />
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove Image
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <FileImage className="w-12 h-12 mx-auto text-gray-400" />
                <div>
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-700 font-medium">
                      Click to upload
                    </span>
                    <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(file);
                    }}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG up to 10MB</p>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyzeImage}
            disabled={!selectedImage || isAnalyzingImage}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
          >
            {isAnalyzingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Analyze Image
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('disease_diagnosis_analysis_results')}
        </h3>

        {imageAnalysis ? (
          <div className="space-y-4">
            {isOfflineMode && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>On-Device Edge Vision (Offline Analysis) • Image & results queued for cloud sync</span>
              </div>
            )}

            <div
              className={`p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${radiusClass}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-800 dark:text-green-200">
                  {t('disease_diagnosis_overall_health')}
                </h4>
              </div>
              <p className="text-green-700 dark:text-green-300">{imageAnalysis.overallHealth}</p>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                <div>
                  {t('disease_diagnosis_confidence')}: {(imageAnalysis.confidence * 100).toFixed(1)}%
                </div>
                <div>
                  {imageAnalysis.reviewStatus === 'needs_expert_review'
                    ? 'Needs expert review'
                    : 'Evidence review available'}
                </div>
                <div>Source: {imageAnalysis.provenance.source}</div>
                {imageAnalysis.provenance.provider && (
                  <div>Provider: {imageAnalysis.provenance.provider}</div>
                )}
              </div>
            </div>

            {imageAnalysis.diseases.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  {t('disease_diagnosis_detected_diseases')}
                </h4>
                <div className="space-y-3">
                  {imageAnalysis.diseases.map(disease => (
                    <div
                      key={disease.disease}
                      className={`p-3 border border-gray-200 dark:border-gray-700 ${radiusClass}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {disease.reviewStatus === 'needs_expert_review' ? 'Possible match: ' : ''}
                          {disease.disease}
                        </h5>
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(disease.severity)}`}
                        >
                          {disease.severity}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('disease_diagnosis_confidence')}: {(disease.confidence * 100).toFixed(1)}%
                      </p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {disease.safetyNotice}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imageAnalysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  {t('disease_diagnosis_recommendations')}
                </h4>
                <ul className="space-y-2">
                  {imageAnalysis.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No analysis results yet</p>
            <p className="text-sm">Upload an image and click analyze</p>
          </div>
        )}
      </div>
    </div>
  );
}
