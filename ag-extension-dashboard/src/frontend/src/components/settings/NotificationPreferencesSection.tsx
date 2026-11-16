import React from 'react';
import { Bell } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { PreferenceKey, useNotificationPreferences } from '@/hooks/useNotificationPreferences';

export function NotificationPreferencesSection({ prefs, saving, toggle }: ReturnType<typeof useNotificationPreferences>) {
  const { t } = useLanguage();
  const rows: Array<{ key: PreferenceKey; label: string }> = [
    { key: 'emailAlerts', label: t('settings_email_alerts') || 'Email Alerts' },
    { key: 'smsAlerts', label: t('settings_sms_alerts') || 'SMS Alerts' },
    { key: 'pushNotifications', label: t('settings_push_notifs') || 'Push Notifications' },
  ];
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Bell className="w-4 h-4" />
        {t('settings_notifications') || 'Notifications'}
      </h3>
      <div className="space-y-2">
        {rows.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              aria-label={label}
              disabled={saving}
              onClick={() => void toggle(key)}
              className={`w-12 h-6 rounded-full transition-colors disabled:opacity-60 ${prefs[key] ? 'bg-primary-600' : 'bg-gray-300'} relative`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
