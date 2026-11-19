import React, { useState } from 'react';
import { OfflineMapsSection } from '@/components/settings/OfflineMapsSection';
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection';
import { OrganizationSection } from '@/components/settings/OrganizationSection';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Map } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, Globe, Monitor, Moon, Sun, Zap, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanguageSwitcher } from './LanguageSwitcher';
import toast from 'react-hot-toast';
import { ChannelOnboardingModal } from './channels/ChannelOnboardingModal';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { themeName, setThemeName, darkMode, setDarkMode } = useAppStore();
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  const notifications = useNotificationPreferences();

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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[80vh] overflow-hidden flex flex-col">
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
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
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
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Map className="w-4 h-4" />
                    {t('ui_settings_panel_offline_maps')}
                  </h3>
                  <OfflineMapsSection />
                </div>
                <NotificationPreferencesSection {...notifications} />

                <OrganizationSection active={isOpen} />

                {/* Communication Gateways & Onboarding */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span>{t('ui_settings_panel_communication_gateways_onboarding')}</span>
                  </h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      {t('ui_settings_panel_manage_sms_africa_s_talking_twilio_w')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChannelModalOpen(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-900/20"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{t('ui_settings_panel_configure_channels_onboarding_wizard')}</span>
                    </button>
                  </div>
                </div>

                {/* Data & Storage */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('settings_data') || 'Data & Storage'}
                  </h3>
                  <button
                    onClick={async () => {
                      const preserveKeys = ['user', 'theme', 'ag-theme-name'];
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
                    onClick={() => void notifications.reset()}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('ui_settings_panel_reset_alert_settings')}
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
