import React from 'react';
import { Activity, FlaskConical, Loader2, Upload } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const FIELD = 'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60';
const LABEL = 'block text-[11px] font-medium text-slate-400 mb-1';

interface Props {
  cropType: string;
  setCropType: (v: string) => void;
  farmNotes: string;
  setFarmNotes: (v: string) => void;
  soilImagePreview: string | null;
  selectedSoilImage: File | null;
  onSelectImage: (f: File) => void;
  onRemoveImage: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

/** The soil photo and its context: crop, field notes and one close-up photo of the topsoil. */
export const SoilSampleForm: React.FC<Props> = ({
  cropType,
  setCropType,
  farmNotes,
  setFarmNotes,
  soilImagePreview,
  selectedSoilImage,
  onSelectImage,
  onRemoveImage,
  onAnalyze,
  isAnalyzing,
}) => {
  const { t } = useLanguage();
  return (
    <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-white flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-emerald-400" />
          {t('ui_soil_sample_form_title', 'Soil photo')}
        </h3>
        <div>
          <label htmlFor="soil-crop" className={LABEL}>
            {t('ui_soil_sample_form_crop', 'Crop you plan to grow')}
          </label>
          <input
            id="soil-crop"
            type="text"
            value={cropType}
            onChange={e => setCropType(e.target.value)}
            placeholder={t('ui_soil_sample_form_crop_hint', 'For example maize, coffee or beans')}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="soil-notes" className={LABEL}>
            {t('ui_soil_sample_form_notes', 'Field notes')}
          </label>
          <textarea
            id="soil-notes"
            value={farmNotes}
            onChange={e => setFarmNotes(e.target.value)}
            placeholder={t('ui_soil_sample_form_notes_hint', 'Slope, how fast water drains, last fertilizer used')}
            rows={2}
            className={`${FIELD} resize-none`}
          />
        </div>
        <div className="rounded-[4px] border border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/80 p-5 text-center transition-colors">
          {soilImagePreview ? (
            <div className="space-y-3">
              <img
                src={soilImagePreview}
                alt={t('ui_soil_sample_form_preview_alt', 'Soil photo to analyze')}
                className="max-w-xs w-full h-40 mx-auto object-cover rounded-[3px] border border-slate-800"
              />
              <button type="button" onClick={onRemoveImage} className="text-xs text-rose-400 hover:text-rose-300 underline">
                {t('ui_soil_sample_form_remove', 'Remove photo')}
              </button>
            </div>
          ) : (
            <label htmlFor="soil-upload" className="block cursor-pointer space-y-2 py-3">
              <Upload className="w-5 h-5 mx-auto text-slate-400" />
              <span className="block text-xs font-medium text-emerald-400 hover:text-emerald-300">
                {t('ui_soil_sample_form_upload', 'Add a soil photo')}
              </span>
              <span className="block text-[11px] text-slate-500">
                {t('ui_soil_sample_form_upload_hint', 'A close-up of the topsoil or a clod, up to 10 MB')}
              </span>
              <input
                id="soil-upload"
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onSelectImage(file);
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onAnalyze}
        disabled={!selectedSoilImage || isAnalyzing}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-[3px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
      >
        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
        <span>{isAnalyzing ? t('ui_soil_sample_form_analyzing', 'Analyzing the photo…') : t('ui_soil_sample_form_analyze', 'Analyze soil photo')}</span>
      </button>
    </div>
  );
};
