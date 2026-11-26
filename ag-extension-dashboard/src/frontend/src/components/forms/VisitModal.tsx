import React from 'react';
import { X, MapPin, Calendar, FileText, User } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useDemoMode } from '@/demo';
import { useVisitScheduler } from './useVisitScheduler';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DictationButton } from '@/components/voice/DictationButton';
import { appendDictation } from '@/lib/dictationText';

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VisitModal: React.FC<VisitModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
  const { loading, loadingFarmers, formData, setFormData, matches, selectFarmer, clearFarmer, handleSubmit } = useVisitScheduler({ isOpen, isDemo, onSuccess, onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex flex-col w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] bg-white dark:bg-theme-bg-tertiary rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 px-6 py-4 border-b border-gray-100 dark:border-white/[0.12]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('visit_create_title') || 'Schedule new visit'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-theme-text-muted">
                {t('visit_create_subtitle') || 'Book a visit with a farmer'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.08] rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Farmer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-text-secondary mb-2">
              <User className="w-4 h-4 inline me-1" />
              {t('visit_select_farmer') || 'Select farmer'} *
            </label>
            <div className="relative">
              <input
                type="text" aria-label="Search farmer"
                value={formData.farmerSearch || ''}
                onChange={e => setFormData({ ...formData, farmerSearch: e.target.value })}
                placeholder={
                  loadingFarmers
                    ? t('common_loading') || 'Loading...'
                    : t('visit_select_farmer_placeholder') || 'Search farmer...'
                }
                disabled={loadingFarmers}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {formData.farmerSearch && !formData.farmerId && (
                <div className="absolute z-10 w-full mt-1 popover-surface rounded-xl max-h-48 overflow-y-auto">
                  {matches
                    .slice(0, 10)
                    .map(farmer => (
                      <button
                        key={farmer.id}
                        type="button"
                        onClick={() => selectFarmer(farmer)}
                        className="w-full px-4 py-2 text-start hover:bg-gray-100 dark:hover:bg-white/[0.12] text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {farmer.firstName} {farmer.lastName}
                        </span>
                        <span className="text-gray-500 dark:text-theme-text-muted ms-2">
                          — {farmer.region}
                        </span>
                      </button>
                    ))}
                  {matches.length === 0 && (
                    <div className="px-4 py-2 text-sm text-gray-600 dark:text-theme-text-muted">{t('chat_no_farmers')}</div>
                  )}
                </div>
              )}
              {formData.farmerId && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t('ui_visit_modal_selected', { farmerSearch: formData.farmerSearch })}
                  </span>
                  <button
                    type="button"
                    onClick={clearFarmer}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {t('ui_visit_modal_change')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Visit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-text-secondary mb-2">
              <FileText className="w-4 h-4 inline me-1" />
              {t('visit_type_label') || 'Visit type'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'routine', label: t('visit_type_routine') || 'Routine' },
                { value: 'follow_up', label: t('visit_type_followup') || 'Follow-up' },
                { value: 'assessment', label: t('visit_type_assessment', 'Farm assessment') },
                { value: 'training', label: t('visit_type_training', 'Training') },
                { value: 'emergency', label: t('visit_type_emergency') || 'Emergency' },
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    formData.type === type.value
                      ? 'bg-primary-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-theme-text-secondary hover:bg-gray-200 dark:hover:bg-white/[0.12]'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-text-secondary mb-2">
              <Calendar className="w-4 h-4 inline me-1" />
              {t('visit_date_time') || 'Date & time'} *
            </label>
            <Input
              type="datetime-local" aria-label="Visit date and time"
              value={formData.scheduledAt}
              onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
              required
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-end justify-between gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-theme-text-secondary">
                <FileText className="w-4 h-4 inline me-1" />
                {t('visit_notes') || 'Notes'} ({t('common_optional') || 'Optional'})
              </label>
              <DictationButton
                fieldLabel={t('visit_notes') || 'Notes'}
                // Kept recordings belong to one farmer's visit; none are kept before a farmer is chosen.
                draftKey={formData.farmerId ? `visit-plan-notes:${formData.farmerId}` : undefined}
                onTranscript={text => setFormData(prev => ({ ...prev, notes: appendDictation(prev.notes, text) }))}
              />
            </div>
            <textarea aria-label="Visit notes"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder={t('visit_notes_placeholder') || 'Add any notes about this visit...'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              {t('common_cancel')}
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!formData.farmerId || !formData.scheduledAt}
              className="flex-1"
            >
              <MapPin className="w-4 h-4" />
              {t('visit_schedule') || 'Schedule visit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VisitModal;
