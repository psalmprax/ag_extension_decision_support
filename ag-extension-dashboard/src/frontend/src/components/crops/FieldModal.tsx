import React from 'react';
import { X } from 'lucide-react';
import { Field } from '@/api/fieldService';
import { useLanguage } from '@/lib/LanguageContext';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { useUnits } from '@/hooks/useUnits';

type FieldForm = {
  name: string;
  areaHectares: string;
  soilType: string;
  soilPh: string;
  latitude: string;
  longitude: string;
};

interface FieldModalProps {
  showFieldModal: boolean;
  setShowFieldModal: (show: boolean) => void;
  editingField: Field | null;
  fieldForm: FieldForm;
  setFieldForm: React.Dispatch<React.SetStateAction<FieldForm>>;
  handleSaveField: () => Promise<void>;
  radiusClass: string;
}

const INPUT =
  'w-full h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-600';

/** Add or edit one field: its name, size, soil and where it is. */
export const FieldModal: React.FC<FieldModalProps> = ({
  showFieldModal,
  setShowFieldModal,
  editingField,
  fieldForm,
  setFieldForm,
  handleSaveField,
}) => {
  const { t } = useLanguage();
  const units = useUnits();
  if (!showFieldModal) return null;

  const title = editingField ? t('field_edit_title', { defaultValue: 'Edit field' }) : t('field_add_title', { defaultValue: 'Add field' });
  const inputs: Array<{ key: keyof FieldForm; label: string; placeholder: string; inputMode?: 'decimal'; required?: boolean; wide?: boolean }> = [
    { key: 'name', label: t('field_name', { defaultValue: 'Field name' }), placeholder: t('field_name_placeholder', { defaultValue: 'For example North plot' }), required: true, wide: true },
    { key: 'areaHectares', label: units.areaUnit === 'ha' ? t('ui_field_modal_area_hectares', { defaultValue: 'Area (hectares)' }) : t('field_area_acres', { defaultValue: 'Area (acres)' }), placeholder: '2.5', inputMode: 'decimal', required: true },
    { key: 'soilType', label: t('ui_field_modal_soil_type', { defaultValue: 'Soil type' }), placeholder: t('field_soil_placeholder', { defaultValue: 'Loam, clay or sand' }) },
    { key: 'soilPh', label: t('ui_crops_overview_tab_soil_ph', { defaultValue: 'Soil pH' }), placeholder: '6.5', inputMode: 'decimal' },
    { key: 'latitude', label: t('latitude', { defaultValue: 'Latitude' }), placeholder: '-1.2863', inputMode: 'decimal' },
    { key: 'longitude', label: t('longitude', { defaultValue: 'Longitude' }), placeholder: '36.8172', inputMode: 'decimal' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-[1200]" onClick={() => setShowFieldModal(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-modal-title"
        onClick={event => event.stopPropagation()}
        className="bg-white dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto"
      >
        <form
          className="p-6 space-y-5"
          onSubmit={event => {
            event.preventDefault();
            void handleSaveField();
          }}
        >
          <div className="flex items-center justify-between">
            <h3 id="field-modal-title" className="text-lg font-medium text-slate-900 dark:text-white">{title}</h3>
            <button
              type="button"
              onClick={() => setShowFieldModal(false)}
              aria-label={t('common_close', { defaultValue: 'Close' })}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]"
            >
              <X className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {inputs.map(input => (
              <div key={input.key} className={input.wide ? 'col-span-2' : ''}>
                <label htmlFor={`field-${input.key}`} className="block text-sm text-slate-600 dark:text-slate-300 mb-1">
                  {input.label}
                </label>
                <input
                  id={`field-${input.key}`}
                  type="text"
                  inputMode={input.inputMode}
                  required={input.required}
                  value={fieldForm[input.key]}
                  onChange={event => setFieldForm(prev => ({ ...prev, [input.key]: event.target.value }))}
                  placeholder={input.placeholder}
                  className={`${INPUT} ${input.inputMode ? 'tabular-nums' : ''}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60">
            {t('field_location_hint', { defaultValue: 'With a location, the field shows on the map and soil data can be looked up for it.' })}
          </p>

          <div className="flex gap-3 pt-2">
            <button type="submit" className={PRIMARY_BUTTON}>
              {editingField ? t('common_save_changes', { defaultValue: 'Save changes' }) : t('field_save', { defaultValue: 'Save field' })}
            </button>
            <button type="button" onClick={() => setShowFieldModal(false)} className={SECONDARY_BUTTON}>
              {t('common_cancel', { defaultValue: 'Cancel' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
