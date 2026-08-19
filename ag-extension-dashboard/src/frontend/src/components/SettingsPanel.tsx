import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Palette, Globe, Monitor, Moon, Sun, Volume2, VolumeX, Zap, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DesignToggle } from './ABTestBanner';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { fetchOrganizationConfig, updateOrganizationConfig, OrganizationConfig } from '@/api/organizationService';
import { downloadKnowledgePack } from '@/api/knowledgeService';
import { ChannelOnboardingModal } from './channels/ChannelOnboardingModal';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { themeName, setThemeName, darkMode, setDarkMode, user } = useAppStore();
  const [organization, setOrganization] = useState<OrganizationConfig | null>(null);
  const [organizationForm, setOrganizationForm] = useState({ name: '', region: '', currency: 'USD', language: 'en' });
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(false);
  const [isOrganizationSaving, setIsOrganizationSaving] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
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
  }, [isOpen, user]);

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
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailAlerts: true,
    smsAlerts: true,
    pushNotifications: true,
    soundEnabled: false,
  });

  const handleToggle = async (key: keyof typeof notificationPrefs) => {
    const updated = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(updated);
    localStorage.setItem('ag-notification-prefs', JSON.stringify(updated));
    try {
      await apiClient.patch('/users/profile', { notificationPreferences: updated });
      toast.success('Settings saved');
    } catch {
      toast.success('Settings saved locally');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                    <Monitor className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('nav_settings') || 'Settings'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Appearance */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    {t('settings_appearance') || 'Appearance'}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        {darkMode ? (
                          <Moon className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Sun className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('settings_dark_mode') || 'Dark Mode'}
                        </span>
                      </div>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-gray-300'} relative`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('settings_theme') || 'Theme'}
                        </span>
                      </div>
                      <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('settings_language') || 'Language'}
                        </span>
                      </div>
                      <LanguageSwitcher />
                    </div>
                    {/* Design Preference */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Palette className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('settings_design') || 'Design'}
                        </span>
                      </div>
                      <DesignToggle />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    {t('settings_notifications') || 'Notifications'}
                  </h3>
                  <div className="space-y-2">
                    {[
                      {
                        key: 'emailAlerts' as const,
                        label: t('settings_email_alerts') || 'Email Alerts',
                        icon: Bell,
                      },
                      {
                        key: 'smsAlerts' as const,
                        label: t('settings_sms_alerts') || 'SMS Alerts',
                        icon: Bell,
                      },
                      {
                        key: 'pushNotifications' as const,
                        label: t('settings_push_notifs') || 'Push Notifications',
                        icon: Bell,
                      },
                      {
                        key: 'soundEnabled' as const,
                        label: t('settings_sound') || 'Sound Effects',
                        icon: notificationPrefs.soundEnabled ? Volume2 : VolumeX,
                      },
                    ].map(({ key, label, icon: Icon }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {label}
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggle(key)}
                          className={`w-12 h-6 rounded-full transition-colors ${notificationPrefs[key] ? 'bg-primary-600' : 'bg-gray-300'} relative`}
                        >
                          <div
                            className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${notificationPrefs[key] ? 'translate-x-6' : 'translate-x-0.5'}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Organization */}
                {organization && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Organization & Region
                    </h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                      {isOrganizationLoading ? (
                        <p className="text-sm text-gray-500">Loading organization settings…</p>
                      ) : (
                        <>
                          <label className="block text-xs font-semibold text-gray-500">Organization name
                            <input value={organizationForm.name} disabled={user?.role !== 'admin'} onChange={e => setOrganizationForm({ ...organizationForm, name: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60" />
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-gray-500">Region
                              <input value={organizationForm.region} disabled={user?.role !== 'admin'} onChange={e => setOrganizationForm({ ...organizationForm, region: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60" />
                            </label>
                            <label className="block text-xs font-semibold text-gray-500">Currency
                              <select value={organizationForm.currency} disabled={user?.role !== 'admin'} onChange={e => setOrganizationForm({ ...organizationForm, currency: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60">
                                {['USD', 'KES', 'MWK', 'ZMW', 'TZS', 'UGX', 'CAD', 'EUR', 'GBP'].map(currency => <option key={currency}>{currency}</option>)}
                              </select>
                            </label>
                          </div>
                          <label className="block text-xs font-semibold text-gray-500">Default language
                            <select value={organizationForm.language} disabled={user?.role !== 'admin'} onChange={e => setOrganizationForm({ ...organizationForm, language: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white disabled:opacity-60">
                              {['en', 'fr', 'sw', 'es', 'de', 'pt'].map(language => <option key={language}>{language}</option>)}
                            </select>
                          </label>
                          {user?.role === 'admin' && <button type="button" onClick={saveOrganization} disabled={isOrganizationSaving} className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{isOrganizationSaving ? 'Saving…' : 'Save organization settings'}</button>}
                          <button type="button" onClick={() => downloadKnowledgePack(organizationForm.region || undefined).then(() => toast.success('Offline knowledge pack downloaded')).catch(() => toast.error('Could not download knowledge pack'))} className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Download offline knowledge pack</button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Communication Gateways & Onboarding */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span>Communication Gateways & Onboarding</span>
                  </h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      Manage SMS (Africa's Talking / Twilio), WhatsApp Business Cloud API, and Telegram Bot credentials for automated farmer advisory and self-registration.
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChannelModalOpen(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-900/20"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Configure Channels & Onboarding Wizard</span>
                    </button>
                  </div>
                </div>

                {/* Data & Storage */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    {t('settings_data') || 'Data & Storage'}
                  </h3>
                  <button
                    onClick={async () => {
                      const preserveKeys = ['token', 'user', 'theme', 'ag-theme-name'];
                      const preserved: Record<string, string> = {};
                      preserveKeys.forEach(key => {
                        const val = localStorage.getItem(key);
                        if (val) preserved[key] = val;
                      });
                      localStorage.clear();
                      Object.entries(preserved).forEach(([key, val]) =>
                        localStorage.setItem(key, val)
                      );
                      sessionStorage.clear();
                      try {
                        const dbs = (await indexedDB.databases?.()) || [];
                        for (const db of dbs) {
                          if (db.name) indexedDB.deleteDatabase(db.name);
                        }
                      } catch {
                        /* indexedDB.databases() not supported */
                      }
                      try {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                      } catch {
                        /* caches API not available */
                      }
                      try {
                        const registrations =
                          (await navigator.serviceWorker?.getRegistrations?.()) || [];
                        for (const reg of registrations) {
                          await reg.update();
                        }
                      } catch {
                        /* service worker not available */
                      }
                      toast.success(
                        'All local cache, session storage, and service worker caches cleared'
                      );
                    }}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('settings_clear_cache') || 'Clear Local Cache'}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const defaults = {
                        emailAlerts: true,
                        smsAlerts: true,
                        pushNotifications: true,
                        soundEnabled: false,
                      };
                      setNotificationPrefs(defaults);
                      localStorage.setItem('ag-notification-prefs', JSON.stringify(defaults));
                      apiClient
                        .patch('/users/profile', { notificationPreferences: defaults })
                        .catch(() => {});
                      toast.success('Settings reset to defaults');
                    }}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Reset All Settings
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
      <ChannelOnboardingModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
      />
    </AnimatePresence>
  );
};

export default SettingsPanel;
