import React from 'react';
import { Camera, FileImage, Loader2 } from 'lucide-react';
import { CropField } from '@/components/edgeVision/CropField';
import { useLanguage } from '@/lib/LanguageContext';
import { SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { PANEL_HEADING } from './panelHeading';

/** The photo card of the leaf photo tab: crop, photo, the camera scanner, and the check button. */
export const ImageUploadViewfinder: React.FC<{
  cropType: string;
  setCropType: (v: string) => void;
  imagePreview: string | null;
  selectedImage: File | null;
  onImageSelect: (f: File) => void;
  onRemoveImage: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onOpenScanner: () => void;
}> = ({
  cropType,
  setCropType,
  imagePreview,
  selectedImage,
  onImageSelect,
  onRemoveImage,
  onAnalyze,
  isAnalyzing,
  onOpenScanner,
}) => {
  const { t } = useLanguage();
  return (
  <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col justify-between space-y-4">
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className={PANEL_HEADING}>{t('ui_image_analysis_tab_specimen_photo_review')}</h3>
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

    <button type="button" onClick={onOpenScanner} className={SECONDARY_BUTTON}>
      <Camera className="w-4 h-4" aria-hidden="true" />
      <span>{t('ui_disease_diagnosis_camera_scan_leaf')}</span>
    </button>
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
