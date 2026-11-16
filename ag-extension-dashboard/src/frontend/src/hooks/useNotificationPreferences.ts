import { useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { useAppStore, type NotificationPreferences } from '@/store/useAppStore';

export type PreferenceKey = keyof NotificationPreferences;

const DEFAULTS: Required<NotificationPreferences> = { emailAlerts: true, smsAlerts: true, pushNotifications: true };

/** Saved choices merged over the defaults: a missing key means the channel is on. */
function effective(prefs: NotificationPreferences | undefined): Required<NotificationPreferences> {
  return { ...DEFAULTS, ...(prefs ?? {}) };
}

/**
 * Saves alert channel choices to the account (PATCH /auth/me). The server
 * applies them when it sends alerts: email and SMS are skipped when off, and
 * in-app alerts are kept but not pushed to the device.
 */
export function useNotificationPreferences() {
  const user = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);
  const [prefs, setPrefs] = useState(() => effective(user?.notificationPreferences));
  const [saving, setSaving] = useState(false);

  const save = async (changes: NotificationPreferences, success: string) => {
    const previous = prefs;
    setPrefs({ ...prefs, ...changes });
    setSaving(true);
    try {
      const { data } = await apiClient.patch('/auth/me', { notificationPreferences: changes });
      const saved = effective(data?.data?.notificationPreferences);
      setPrefs(saved);
      if (user) setUser({ ...user, notificationPreferences: saved });
      toast.success(success);
    } catch (error) {
      setPrefs(previous);
      console.error('Saving notification preferences failed:', error);
      toast.error('Could not save your alert settings. Nothing was changed.');
    } finally {
      setSaving(false);
    }
  };

  return {
    prefs,
    saving,
    toggle: (key: PreferenceKey) => save({ [key]: !prefs[key] }, 'Alert settings saved'),
    reset: () => save(DEFAULTS, 'Alert settings reset: all channels on'),
  };
}
