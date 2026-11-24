import { useLanguage } from '@/lib/LanguageContext';
import { useModelCrops } from './useModelCrops';

/**
 * The photo check's crop field. It suggests the crops the phone's model knows: naming one lets
 * a sure answer from the phone stand without the online check.
 */
export function CropField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLanguage();
  const crops = useModelCrops();
  return (
    <div>
      <label htmlFor="diagnosis-photo-crop" className="block text-sm text-slate-400 mb-1">
        {t('diagnosis_photo_crop', { defaultValue: 'Crop (optional)' })}
      </label>
      <input
        id="diagnosis-photo-crop"
        type="text"
        list={crops.length > 0 ? 'diagnosis-photo-crop-options' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('diagnosis_photo_crop_placeholder', { defaultValue: 'For example maize, coffee or tomato' })}
        className="w-full px-3 py-2 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors"
      />
      {crops.length > 0 && (
        <>
          <datalist id="diagnosis-photo-crop-options">
            {crops.map(crop => <option key={crop} value={crop} />)}
          </datalist>
          <p className="mt-1 text-xs text-slate-500 dark:text-theme-text-muted">
            {t('diagnosis_photo_crop_hint', { defaultValue: 'Name the crop so this phone can answer without the online check when it is sure.' })}
          </p>
        </>
      )}
    </div>
  );
}
