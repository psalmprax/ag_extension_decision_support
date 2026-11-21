import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, RefreshCw, MapPin, Languages, Sprout, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    updates: Partial<{ region: string; languagePreference: string; crops: string[] }>
  ) => void;
  selectedCount: number;
  isLoading?: boolean;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
  selectedCount,
  isLoading = false,
}) => {
  const { t } = useLanguage();
  const [updates, setUpdates] = useState({
    region: '',
    languagePreference: '',
    crops: [] as string[],
  });

  const [newCrop, setNewCrop] = useState('');

  const handleAddCrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCrop && !updates.crops.includes(newCrop)) {
      setUpdates(prev => ({ ...prev, crops: [...prev.crops, newCrop] }));
      setNewCrop('');
    }
  };

  const handleRemoveCrop = (crop: string) => {
    setUpdates(prev => ({ ...prev, crops: prev.crops.filter(c => c !== crop) }));
  };

  const handleUpdate = () => {
    // Only include fields that have been set
    const finalUpdates: Record<string, unknown> = {};
    if (updates.region) finalUpdates.region = updates.region;
    if (updates.languagePreference) finalUpdates.languagePreference = updates.languagePreference;
    if (updates.crops.length > 0) finalUpdates.crops = updates.crops;

    if (Object.keys(finalUpdates).length === 0) return;
    onUpdate(finalUpdates);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      {t('ui_bulk_update_modal_bulk_update_farmers')}
                    </h3>
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                      {t('ui_bulk_update_modal_updating_farmers', { selectedCount })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800 flex gap-3">
                <AlertCircle className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0" />
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {t('ui_bulk_update_modal_selected_fields_will_be_updated_for')} <strong>{t('ui_bulk_update_modal_all')}</strong> {selectedCount} {t('ui_bulk_update_modal_selected_farmers_leave_fields_empty')}
                </p>
              </div>

              {/* Region */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {t('common_region')}
                </label>
                <select
                  value={updates.region}
                  onChange={e => setUpdates(prev => ({ ...prev, region: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all dark:text-white"
                >
                  <option value="">{t('ui_bulk_update_modal_keep_existing_region')}</option>
                  <option value="Central">{t('ui_bulk_update_modal_central')}</option>
                  <option value="Rift Valley">{t('ui_bulk_update_modal_rift_valley')}</option>
                  <option value="Eastern">{t('ui_bulk_update_modal_eastern')}</option>
                  <option value="Nyanza">{t('ui_bulk_update_modal_nyanza')}</option>
                  <option value="Western">{t('ui_bulk_update_modal_western')}</option>
                  <option value="Coast">{t('ui_bulk_update_modal_coast')}</option>
                  <option value="North Eastern">{t('ui_bulk_update_modal_north_eastern')}</option>
                </select>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5" />
                  {t('ui_bulk_update_modal_language_preference')}
                </label>
                <select
                  value={updates.languagePreference}
                  onChange={e =>
                    setUpdates(prev => ({ ...prev, languagePreference: e.target.value }))
                  }
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all dark:text-white"
                >
                  <option value="">{t('ui_bulk_update_modal_keep_existing_language')}</option>
                  <option value="en">{t('ui_bulk_update_modal_english')}</option>
                  <option value="sw">{t('ui_bulk_update_modal_swahili')}</option>
                  <option value="fr">{t('ui_bulk_update_modal_french')}</option>
                </select>
              </div>

              {/* Crops */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Sprout className="w-3.5 h-3.5" />
                  {t('ui_bulk_update_modal_crop_types_overrides_existing')}
                </label>
                <form onSubmit={handleAddCrop} className="flex gap-2">
                  <input
                    type="text"
                    value={newCrop}
                    onChange={e => setNewCrop(e.target.value)}
                    placeholder="Add crop (e.g. Maize, Coffee)..."
                    className="flex-1 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium hover:bg-gray-200 transition-all"
                  >
                    {t('common_add')}
                  </button>
                </form>
                <div className="flex flex-wrap gap-2 mt-2">
                  {updates.crops.map(crop => (
                    <div
                      key={crop}
                      className="flex items-center gap-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-md text-xs font-medium"
                    >
                      {crop}
                      <button
                        onClick={() => handleRemoveCrop(crop)}
                        className="hover:text-primary-900 dark:hover:text-primary-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-xs rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('nav_cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleUpdate}
                disabled={
                  (!updates.region && !updates.languagePreference && updates.crops.length === 0) ||
                  isLoading
                }
                className="flex-[2] px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isLoading ? 'Updating...' : `Update ${selectedCount} farmers`}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
