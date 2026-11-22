import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { CONTINENT_ORDER, SUPPORTED_COUNTRIES, findCountry } from '@/lib/countries';

const SELECT =
  'w-full h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';

/**
 * Where the person works and their time zone. The country decides how phone numbers are
 * read, which prices are shown, money and land units; the time zone decides "today" in
 * SMS commands and working hours.
 */
export function CountryTimeSection() {
  const { t } = useLanguage();
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const [country, setCountry] = useState(user?.country ?? '');
  const [timeZone, setTimeZone] = useState(user?.timeZone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCountry(user?.country ?? '');
    setTimeZone(user?.timeZone ?? '');
  }, [user?.country, user?.timeZone]);

  const zones = findCountry(country)?.timeZones ?? [];
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoneOptions = Array.from(new Set([...zones, ...(browserZone ? [browserZone] : [])]));
  const changed = country !== (user?.country ?? '') || timeZone !== (user?.timeZone ?? '');

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data } = await apiClient.patch('/auth/me', {
        ...(country ? { country } : {}),
        ...(timeZone ? { timeZone } : {}),
      });
      setUser({ ...user, country: data?.data?.country ?? country, timeZone: data?.data?.timeZone ?? (timeZone || null) });
      toast.success(t('settings_country_saved', { defaultValue: 'Country and time zone saved.' }));
    } catch (error) {
      console.error('Saving country and time zone failed:', error);
      toast.error(t('settings_country_failed', { defaultValue: 'Could not save. Nothing was changed.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Clock className="w-4 h-4" aria-hidden="true" />
        {t('settings_country_title', { defaultValue: 'Country and time zone' })}
      </h3>
      <div className="p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl space-y-3">
        <label className="block text-sm">
          <span className="block mb-1 text-gray-700 dark:text-gray-300">{t('register_country_label', { defaultValue: 'Country' })}</span>
          <select
            className={SELECT}
            value={country}
            onChange={event => {
              setCountry(event.target.value);
              setTimeZone('');
            }}
          >
            <option value="">{t('users_no_country', { defaultValue: 'Country not set' })}</option>
            {CONTINENT_ORDER.map(continent => (
              <optgroup key={continent} label={continent}>
                {SUPPORTED_COUNTRIES.filter(c => c.continent === continent).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="block mb-1 text-gray-700 dark:text-gray-300">{t('settings_time_zone', { defaultValue: 'Time zone' })}</span>
          <select className={SELECT} value={timeZone} onChange={event => setTimeZone(event.target.value)}>
            <option value="">
              {zones[0]
                ? t('settings_time_zone_country', { zone: zones[0], defaultValue: 'Country default ({zone})' })
                : t('settings_time_zone_none', { defaultValue: 'Choose a country first' })}
            </option>
            {zoneOptions.map(zone => <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!changed || saving}
          className="h-9 px-3 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium disabled:opacity-40"
        >
          {saving ? t('common_saving', { defaultValue: 'Saving…' }) : t('common_save', { defaultValue: 'Save' })}
        </button>
      </div>
    </div>
  );
}
