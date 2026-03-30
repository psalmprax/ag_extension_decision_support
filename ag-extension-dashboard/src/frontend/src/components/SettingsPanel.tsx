import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Palette, Globe, Monitor, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanguageSwitcher } from './LanguageSwitcher';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const { themeName, setThemeName, darkMode, setDarkMode } = useAppStore();
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
                                                {darkMode ? <Moon className="w-4 h-4 text-gray-400" /> : <Sun className="w-4 h-4 text-gray-400" />}
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    {t('settings_dark_mode') || 'Dark Mode'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setDarkMode(!darkMode)}
                                                className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-gray-300'} relative`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
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

                                {/* Notifications */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Bell className="w-4 h-4" />
                                        {t('settings_notifications') || 'Notifications'}
                                    </h3>
                                    <div className="space-y-2">
                                        {[
                                            { key: 'emailAlerts' as const, label: t('settings_email_alerts') || 'Email Alerts', icon: Bell },
                                            { key: 'smsAlerts' as const, label: t('settings_sms_alerts') || 'SMS Alerts', icon: Bell },
                                            { key: 'pushNotifications' as const, label: t('settings_push_notifs') || 'Push Notifications', icon: Bell },
                                            { key: 'soundEnabled' as const, label: t('settings_sound') || 'Sound Effects', icon: notificationPrefs.soundEnabled ? Volume2 : VolumeX },
                                        ].map(({ key, label, icon: Icon }) => (
                                            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <Icon className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleToggle(key)}
                                                    className={`w-12 h-6 rounded-full transition-colors ${notificationPrefs[key] ? 'bg-primary-600' : 'bg-gray-300'} relative`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${notificationPrefs[key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Data & Storage */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                        {t('settings_data') || 'Data & Storage'}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem('ag-notification-prefs');
                                            toast.success('Cache cleared');
                                        }}
                                        className="w-full p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {t('settings_clear_cache') || 'Clear Local Cache'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default SettingsPanel;
