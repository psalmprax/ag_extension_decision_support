import React from 'react';
import { Modal } from '@/components/Modal';
import type { EmailTemplate } from '@/api/emailWorkflowService';
import type { EditForm } from '@/types/emailWorkflows';
import { useLanguage } from '@/lib/LanguageContext';

export function EmailWorkflowsEditModal({
  template,
  editForm,
  onChange,
  onSave,
  onClose,
}: {
  template: EmailTemplate;
  editForm: EditForm;
  onChange: (next: EditForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal
      title={`Edit Template: ${template.displayName || template.name}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('ui_help_center_modal_category')}
          </label>
          <select
            value={editForm.category}
            onChange={e => onChange({ ...editForm, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="visits">{t('nav_visits')}</option>
            <option value="alerts">{t('farmer_alerts')}</option>
            <option value="market">{t('ui_edit_modal_market')}</option>
            <option value="weather">{t('chat_weather')}</option>
            <option value="training">{t('visit_type_training')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('email_workflows_subject')}
          </label>
          <input
            type="text"
            value={editForm.subject}
            onChange={e => onChange({ ...editForm, subject: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Email subject line"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('ui_edit_modal_body')}
          </label>
          <textarea
            value={editForm.body}
            onChange={e => onChange({ ...editForm, body: e.target.value })}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
            placeholder="Email body content"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('ui_edit_modal_variables_comma_separated')}
          </label>
          <input
            type="text"
            value={editForm.variables.join(', ')}
            onChange={e =>
              onChange({
                ...editForm,
                variables: e.target.value
                  .split(',')
                  .map(v => v.trim())
                  .filter(v => v),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="farmerName, location, visitDate"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          {t('common_cancel')}
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {t('ui_profile_modal_save_changes')}
        </button>
      </div>
    </Modal>
  );
}
