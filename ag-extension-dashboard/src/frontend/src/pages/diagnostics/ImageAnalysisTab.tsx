import React from 'react';
import { Camera, FileImage, Loader2, CheckCircle, CloudOff, ShieldAlert, Check } from 'lucide-react';
import {
  type DiagnosticProvenance,
  type DiseaseDiagnosis,
  type DiagnosticReviewStatus,
} from '../../api/diseaseService';
import { OnDevicePhotoResult } from '@/components/edgeVision/OnDevicePhotoResult';
import { usePhotoCheck } from './usePhotoCheck';
import { CropField } from '@/components/edgeVision/CropField';
import { DiseaseSaliencyCanvas } from '@/components/canvas-ui/DiseaseSaliencyCanvas';
import { useLanguage } from '@/lib/LanguageContext';
import { DiagnosisValidationNote, type DiagnosisValidation } from '@/components/diagnosisTests/DiagnosisValidationNote';
import { PossibleCause } from '@/components/diagnosis/PossibleCause';
import { useHowSure } from '@/hooks/useHowSure';
import { useTranslatedTexts } from '@/hooks/useTranslatedTexts';
import { TranslationNotice } from '@/components/diagnosis/TranslationNotice';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  t: (key: string) => string;
  addNotification: (notification: { type: string; message: string }) => void;
  getSeverityColor: (severity: string) => string;
}

export interface ImageAnalysisData {
  overallHealth: string;
  diseases: DiseaseDiagnosis[];
  nutrientDeficiencies?: string[];
  recommendations: string[];
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
  validation?: DiagnosisValidation | null;
}

function diagnosticSourceLabel({ source, provider }: DiagnosticProvenance): string {
  return provider && !source.toLowerCase().includes(provider.toLowerCase())
    ? `${source} (${provider})`
    : source;
}

const ImageUploadViewfinder: React.FC<{
  cropType: string;
  setCropType: (v: string) => void;
  imagePreview: string | null;
  selectedImage: File | null;
  onImageSelect: (f: File) => void;
  onRemoveImage: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}> = ({
  cropType,
  setCropType,
  imagePreview,
  selectedImage,
  onImageSelect,
  onRemoveImage,
  onAnalyze,
  isAnalyzing,
}) => {
  const { t } = useLanguage();
  return (
  <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col justify-between space-y-4">
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-slate-400" aria-hidden="true" />
          {t('diagnosis_photo_title', { defaultValue: 'Leaf photo' })}
        </h3>
      </div>

      <div className="space-y-3">
        <CropField value={cropType} onChange={setCropType} />

        <div className="relative rounded-lg border-2 border-dashed border-slate-900/[0.08] dark:border-white/[0.08] hover:border-emerald-500/60 bg-white dark:bg-theme-bg-primary p-5 text-center transition-colors group overflow-hidden">
          {imagePreview ? (
            <div className="space-y-3 relative z-10">
              <div className="relative max-w-xs mx-auto rounded-md overflow-hidden border border-emerald-500/40">
                <img src={imagePreview} alt={t('diagnosis_photo_alt', { defaultValue: 'Leaf photo to check' })} className="w-full h-44 object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-emerald-500/50" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onRemoveImage}
                className="text-xs text-rose-400 hover:text-rose-300 underline"
              >
                {t('diagnosis_photo_retake', { defaultValue: 'Choose another photo' })}
              </button>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <div className="w-12 h-12 mx-auto rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
                <FileImage className="w-6 h-6" />
              </div>
              <div>
                <label htmlFor="image-upload" className="cursor-pointer">
                  <span className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
                    {t('diagnosis_photo_pick', { defaultValue: 'Take or choose a photo of the leaf' })}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('diagnosis_photo_formats', { defaultValue: 'JPG or PNG, up to 10 MB' })}
                  </p>
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) onImageSelect(file);
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <button
      onClick={onAnalyze}
      disabled={!selectedImage || isAnalyzing}
      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
          <span>{t('diagnosis_photo_checking', { defaultValue: 'Checking the photo…' })}</span>
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" />
          <span>{t('diagnosis_photo_check', { defaultValue: 'Check this photo' })}</span>
        </>
      )}
    </button>
  </div>
  );
};

export const AnalysisResultsHUD: React.FC<{
  imageAnalysis: ImageAnalysisData | null;
  imagePreview: string | null;
  offlineQueued: boolean;
  getSeverityColor: (s: string) => string;
}> = ({ imageAnalysis, imagePreview, offlineQueued, getSeverityColor: _getSeverityColor }) => {
  const { t } = useLanguage();
  const howSure = useHowSure();
  // The check writes in English; health, nutrient notes and guidance are shown in the app language.
  const nutrients = imageAnalysis?.nutrientDeficiencies ?? [];
  const translation = useTranslatedTexts(imageAnalysis ? [imageAnalysis.overallHealth, ...nutrients, ...imageAnalysis.recommendations] : []);
  const [shownHealth, ...shownLists] = translation.texts;
  const shownNutrients = shownLists.slice(0, nutrients.length);
  const shownRecommendations = shownLists.slice(nutrients.length);
  if (offlineQueued) {
    return (
      <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-amber-500/40 flex flex-col justify-center space-y-4">
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{t('ui_image_analysis_tab_offline_diagnosis_pending_connectivi')}</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-theme-text-secondary leading-relaxed">
          {t('ui_image_analysis_tab_there_is_no_on_device_ai_model_so_no')}
        </p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('ui_image_analysis_tab_the_photo_has_been_queued_and_will_b')}
        </p>
      </div>
    );
  }

  if (!imageAnalysis) {
    return (
      <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col justify-center space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">
            {t('diagnosis_result_title', { defaultValue: 'Result' })}
          </span>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-theme-bg-primary">
          <DiseaseSaliencyCanvas />
        </div>
        <p className="text-xs text-center text-slate-400">
          {t('ui_image_analysis_tab_upload_a_specimen_photo_on_the_left')}
        </p>
      </div>
    );
  }

  const analysisUnavailable = imageAnalysis.recommendations.includes(
    'Analysis was unavailable; do not treat this as a diagnosis'
  );
  const needsReview = imageAnalysis.reviewStatus === 'needs_expert_review' ||
    imageAnalysis.provenance.evidenceStatus !== 'verified_source';

  return (
    <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-4">
      <div className="rounded-lg p-2 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08]">
        <div className="px-2 py-1 mb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
          <span className="text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
            {t('ui_image_analysis_tab_specimen_photo_review')}
          </span>
        </div>
        <DiseaseSaliencyCanvas imageSrc={imagePreview || undefined} detections={[]} />
      </div>

      {!analysisUnavailable && <DiagnosisValidationNote validation={imageAnalysis.validation} />}
      {!analysisUnavailable && <TranslationNotice translation={translation} />}
      {analysisUnavailable ? (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs">{t('ui_image_analysis_tab_analysis_unavailable_no_diagnosis_wa')}</p>
        </div>
      ) : (
        /* Health Metric Banner */
        <div className={`p-3.5 rounded-lg bg-white dark:bg-theme-bg-primary border ${needsReview ? 'border-amber-500/30' : 'border-emerald-500/30'} space-y-1`}>
          <div className="flex items-center gap-2">
            {needsReview
              ? <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              : <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
            <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
              {t('diag_plant_health', { defaultValue: 'Plant health: {health}', health: shownHealth })}
            </h4>
          </div>
          <p className="text-xs text-slate-700 dark:text-theme-text-secondary">{howSure(imageAnalysis.confidence)}</p>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted">
            {t('ui_image_analysis_tab_source')} {diagnosticSourceLabel(imageAnalysis.provenance)}
          </p>
        </div>
      )}

      {!analysisUnavailable && needsReview && (
        <p className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
          {t('ui_image_analysis_tab_unconfirmed_image_observations_not_a')}
        </p>
      )}

      {!analysisUnavailable && Boolean(imageAnalysis.nutrientDeficiencies?.length) && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-900 dark:text-white">{t('ui_image_analysis_tab_possible_nutrient_issues_unconfirmed')}</h4>
          <ul className="list-disc ps-4 space-y-1 text-xs text-slate-700 dark:text-theme-text-secondary">
            {shownNutrients.map((observation, index) => (
              <li key={index}>{observation}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted">
            {t('ui_image_analysis_tab_appearance_alone_cannot_confirm_a_de')}
          </p>
        </div>
      )}

      {/* What it could be */}
      {imageAnalysis.diseases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-900 dark:text-white">
            {t('ui_image_analysis_tab_possible_pathological_matches')}
          </h4>
          <div className="space-y-2">
            {imageAnalysis.diseases.map(disease => (
              <PossibleCause
                key={disease.disease}
                disease={disease.disease}
                confidence={disease.confidence}
                severity={disease.severity}
                description={disease.description}
                symptoms={Array.isArray(disease.symptoms) ? disease.symptoms : undefined}
                safetyNotice={disease.safetyNotice}
                confirmedBySource={disease.reviewStatus !== 'needs_expert_review' && disease.provenance.evidenceStatus === 'verified_source'}
              />
            ))}
          </div>
        </div>
      )}

      {imageAnalysis.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-900 dark:text-white">
            {t('ui_image_analysis_tab_guidance')}
          </h4>
          <div className="grid grid-cols-1 gap-1.5">
            {shownRecommendations.map((rec, index) => (
              <div
                key={index}
                className="p-2 rounded-lg bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-theme-text-secondary flex items-start gap-2"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function ImageAnalysisTab({
  cropType,
  setCropType,
  radiusClass: _radiusClass,
  btnClass: _btnClass,
  t: _t,
  addNotification,
  getSeverityColor,
}: Props) {
  const check = usePhotoCheck(cropType, addNotification);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ImageUploadViewfinder
        cropType={cropType}
        setCropType={setCropType}
        imagePreview={check.imagePreview}
        selectedImage={check.selectedImage}
        onImageSelect={check.handleImageSelect}
        onRemoveImage={check.removeImage}
        onAnalyze={check.handleAnalyzeImage}
        isAnalyzing={check.isAnalyzingImage}
      />

      {check.onDevice && !check.imageAnalysis ? (
        <OnDevicePhotoResult result={check.onDevice.result} reason={check.onDevice.reason} onCloudCheck={check.handleOnlineCheck} cloudBusy={check.isAnalyzingImage} />
      ) : (
        <AnalysisResultsHUD
          imageAnalysis={check.imageAnalysis}
          imagePreview={check.imagePreview}
          offlineQueued={check.offlineQueued}
          getSeverityColor={getSeverityColor}
        />
      )}
    </div>
  );
}
