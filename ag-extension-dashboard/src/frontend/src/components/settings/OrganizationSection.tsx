import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import {
  fetchOrganizationConfig,
  updateOrganizationConfig,
  type OrganizationConfig,
} from '@/api/organizationService';
import { downloadKnowledgePack } from '@/api/knowledgeService';
import { ChatTurnTakingSection } from '@/components/settings/ChatTurnTakingSection';
import { useLanguage } from '@/lib/LanguageContext';

/** Organisation name, region, currency and language, plus (admins) the farmer chat rules. */
export const OrganizationSection: React.FC<{ active: boolean }> = ({ active }) => {
  const { t } = useLanguage();
  const user = useAppStore(state => state.user);
  const [organization, setOrganization] = useState<OrganizationConfig | null>(null);
  const [organizationForm, setOrganizationForm] = useState({
    name: '',
    region: '',
    currency: 'USD',
    language: 'en',
  });
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(false);
  const [isOrganizationSaving, setIsOrganizationSaving] = useState(false);

  useEffect(() => {
    if (!active || !user) return;
    setIsOrganizationLoading(true);
    fetchOrganizationConfig()
      .then(response => {
        setOrganization(response.data);
        setOrganizationForm({
          name: response.data.name,
          region: response.data.region || '',
          currency: response.data.default_currency,
          language: response.data.default_language,
        });
      })
      .catch(() => setOrganization(null))
      .finally(() => setIsOrganizationLoading(false));
  }, [active, user]);

  const saveOrganization = async () => {
    setIsOrganizationSaving(true);
    try {
      const response = await updateOrganizationConfig(organizationForm);
      setOrganization(response.data);
      toast.success('Organization settings saved');
    } catch {
      toast.error('Only organization administrators can change these settings');
    } finally {
      setIsOrganizationSaving(false);
    }
  };

  return (
    <>
      {/* Organization */}
      {organization && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('ui_organization_section_organization_region')}
          </h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
            {isOrganizationLoading ? (
              <p className="text-sm text-gray-500">{t('ui_organization_section_loading_organization_settings')}</p>
            ) : (
              <>
                <label className="block text-xs font-semibold text-gray-500">
                  {t('ui_organization_section_organization_name')}
                  <input
                    value={organizationForm.name}
                    disabled={user?.role !== 'admin'}
                    onChange={e =>
                      setOrganizationForm({ ...organizationForm, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-gray-500">
                    {t('common_region')}
                    <input
                      value={organizationForm.region}
                      disabled={user?.role !== 'admin'}
                      onChange={e =>
                        setOrganizationForm({ ...organizationForm, region: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-gray-500">
                    {t('ui_organization_section_currency')}
                    <select
                      value={organizationForm.currency}
                      disabled={user?.role !== 'admin'}
                      onChange={e =>
                        setOrganizationForm({ ...organizationForm, currency: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60"
                    >
                      {['USD', 'KES', 'MWK', 'ZMW', 'TZS', 'UGX', 'CAD', 'EUR', 'GBP'].map(
                        currency => (
                          <option key={currency}>{currency}</option>
                        )
                      )}
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-semibold text-gray-500">
                  {t('ui_organization_section_default_language')}
                  <select
                    value={organizationForm.language}
                    disabled={user?.role !== 'admin'}
                    onChange={e =>
                      setOrganizationForm({ ...organizationForm, language: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60"
                  >
                    {['en', 'fr', 'sw', 'es', 'de', 'pt'].map(language => (
                      <option key={language}>{language}</option>
                    ))}
                  </select>
                </label>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={saveOrganization}
                    disabled={isOrganizationSaving}
                    className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isOrganizationSaving ? 'Saving…' : 'Save organization settings'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    downloadKnowledgePack(organizationForm.region || undefined)
                      .then(() => toast.success('Offline knowledge pack downloaded'))
                      .catch(() => toast.error('Could not download knowledge pack'))
                  }
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200"
                >
                  {t('ui_organization_section_download_offline_knowledge_pack')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {user?.role === 'admin' && <ChatTurnTakingSection tenantId={organization?.id} />}
    </>
  );
};
