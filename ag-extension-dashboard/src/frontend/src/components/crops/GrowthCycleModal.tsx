import React from 'react';
import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';
import { Field } from '@/api/fieldService';
import { useLanguage } from '@/lib/LanguageContext';

interface GrowthCycleModalProps {
  showCycleModal: boolean;
  setShowCycleModal: (show: boolean) => void;
  selectedField: Field | null;
  cycleForm: {
    cropName: string;
    variety: string;
    plantingDate: string;
    expectedHarvestDate: string;
    notes: string;
  };
  setCycleForm: React.Dispatch<
    React.SetStateAction<{
      cropName: string;
      variety: string;
      plantingDate: string;
      expectedHarvestDate: string;
      notes: string;
    }>
  >;
  handleStartCycle: () => Promise<void>;
  radiusClass: string;
}

export const GrowthCycleModal: React.FC<GrowthCycleModalProps> = ({
  showCycleModal,
  setShowCycleModal,
  selectedField,
  cycleForm,
  setCycleForm,
  handleStartCycle,
  radiusClass,
}) => {
  const { t } = useLanguage();
  if (!showCycleModal || !selectedField) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/[0.04] dark:bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto custom-scrollbar shadow-2xl"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
            <h3 className="text-xl font-medium text-slate-900 dark:text-theme-text-primary flex items-center gap-2">
              <Sprout className="w-5 h-5 text-primary-400" />
              {t('ui_growth_cycle_modal_plant_crop_on')} {selectedField.name}
            </h3>
            <button
              onClick={() => setShowCycleModal(false)}
              className="text-slate-600 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-white text-xl font-medium"
            >
              {t('ui_field_modal_text')}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 dark:text-theme-text-secondary mb-1">
                {t('ui_growth_cycle_modal_crop_name_type')}
              </label>
              <input
                type="text"
                value={cycleForm.cropName}
                onChange={e => setCycleForm(prev => ({ ...prev, cropName: e.target.value }))}
                placeholder="e.g. Maize, Sorghum, Coffee"
                className={`w-full px-4 py-2.5 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] ${radiusClass} text-slate-900 dark:text-theme-text-primary focus:ring-2 focus:ring-primary-500 focus:outline-none`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 dark:text-theme-text-secondary mb-1">
                {t('ui_growth_cycle_modal_crop_variety')}
              </label>
              <input
                type="text"
                value={cycleForm.variety}
                onChange={e => setCycleForm(prev => ({ ...prev, variety: e.target.value }))}
                placeholder="e.g. H614, Katumani"
                className={`w-full px-4 py-2.5 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] ${radiusClass} text-slate-900 dark:text-theme-text-primary focus:ring-2 focus:ring-primary-500 focus:outline-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 dark:text-theme-text-secondary mb-1">
                  {t('ui_crop_cycles_table_planting_date')}
                </label>
                <input
                  type="date"
                  value={cycleForm.plantingDate}
                  onChange={e =>
                    setCycleForm(prev => ({ ...prev, plantingDate: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] ${radiusClass} text-slate-700 dark:text-theme-text-secondary focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 dark:text-theme-text-secondary mb-1">
                  {t('ui_growth_cycle_modal_est_harvest_date')}
                </label>
                <input
                  type="date"
                  value={cycleForm.expectedHarvestDate}
                  onChange={e =>
                    setCycleForm(prev => ({ ...prev, expectedHarvestDate: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] ${radiusClass} text-slate-700 dark:text-theme-text-secondary focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 dark:text-theme-text-secondary mb-1">
                {t('ui_growth_cycle_modal_notes_recommendations')}
              </label>
              <textarea
                value={cycleForm.notes}
                onChange={e => setCycleForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add details on fertilizers applied or seeds used..."
                rows={3}
                className={`w-full px-4 py-2.5 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] ${radiusClass} text-slate-900 dark:text-theme-text-primary focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none`}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
              <button
                onClick={handleStartCycle}
                className="flex-1 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium transition-all rounded-xl"
              >
                {t('ui_growth_cycle_modal_initialize_growth_cycle')}
              </button>
              <button
                onClick={() => setShowCycleModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-theme-bg-tertiary hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-theme-text-secondary font-medium transition-all rounded-xl"
              >
                {t('common_cancel')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
