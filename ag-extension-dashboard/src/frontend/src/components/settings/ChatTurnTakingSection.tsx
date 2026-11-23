import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchTurnTakingSettings, saveTurnTakingSettings, type TurnTakingSettings } from '@/api/chatbotService';
import { useLanguage } from '@/lib/LanguageContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Every time zone the browser knows, so a team anywhere can set its own hours. */
const TIME_ZONES: string[] = (() => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  return intl.supportedValuesOf ? ['UTC', ...intl.supportedValuesOf('timeZone')] : ['UTC'];
})();

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-theme-bg-tertiary px-3 py-2 text-sm dark:text-white';

function NumberField({ label, hint, value, min, max, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-gray-500">
      {label}
      <input type="number" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className={inputClass} />
      <span className="mt-1 block font-normal text-gray-400">{hint}</span>
    </label>
  );
}

/**
 * Admins set how farmers and the AI take turns: how long a farmer waits for
 * their officer, when officers work, how long the AI holds back after an
 * officer replies, and how many AI answers a farmer can get by SMS per day.
 */
export const ChatTurnTakingSection: React.FC<{ tenantId?: string }> = ({ tenantId }) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['chat-turn-taking'], queryFn: fetchTurnTakingSettings });
  const [form, setForm] = useState<TurnTakingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);

  if (isLoading || !form) {
    return <p className="text-sm text-gray-500">{t('ui_chat_turn_taking_section_loading_farmer_chat_settings')}</p>;
  }

  const hours = form.workingHours;
  const setHours = (patch: Partial<TurnTakingSettings['workingHours']>) =>
    setForm({ ...form, workingHours: { ...hours, ...patch } });
  const toggleDay = (day: number) =>
    setHours({ days: hours.days.includes(day) ? hours.days.filter(d => d !== day) : [...hours.days, day].sort() });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveTurnTakingSettings(form, tenantId ?? data?.tenantId ?? undefined);
      setForm(saved.settings);
      queryClient.setQueryData(['chat-turn-taking'], saved);
      toast.success('Farmer chat settings saved');
    } catch (error) {
      const message = isAxiosError(error) ? (error.response?.data as { error?: string } | undefined)?.error : undefined;
      toast.error(message ?? 'Could not save farmer chat settings. Nothing was changed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-gray-500 dark:text-theme-text-muted flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        {t('ui_chat_turn_taking_section_farmer_chat_officer_and_ai')}
      </h3>
      <div className="p-4 bg-gray-50 dark:bg-white/[0.04] rounded-xl space-y-3">
        <p className="text-xs text-gray-500 dark:text-theme-text-muted">
          {t('ui_chat_turn_taking_section_farmers_can_ask_the_ai_at_any_time_i')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Wait for the officer (minutes)" hint="Before the AI answers" value={form.aiFallbackMinutes} min={1} max={1440}
            onChange={n => setForm({ ...form, aiFallbackMinutes: n })} />
          <NumberField label="AI holds back after an officer reply (minutes)" hint="The farmer can still tap Ask AI" value={form.aiPauseAfterOfficerMinutes} min={0} max={1440}
            onChange={n => setForm({ ...form, aiPauseAfterOfficerMinutes: n })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-500">{t('ui_chat_turn_taking_section_working_hours_start')}
            <input type="time" value={hours.start} onChange={e => setHours({ start: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-xs font-medium text-gray-500">{t('ui_chat_turn_taking_section_working_hours_end')}
            <input type="time" value={hours.end} onChange={e => setHours({ end: e.target.value })} className={inputClass} />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-gray-500">{t('ui_chat_turn_taking_section_working_days')}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((label, day) => (
              <button key={label} type="button" aria-pressed={hours.days.includes(day)} onClick={() => toggleDay(day)}
                className={`px-2.5 py-1 rounded-lg text-xs border ${hours.days.includes(day)
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-theme-bg-tertiary border-gray-200 dark:border-white/[0.12] text-gray-700 dark:text-theme-text-primary'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-500">{t('ui_chat_turn_taking_section_time_zone')}
            <select value={hours.timezone} onChange={e => setHours({ timezone: e.target.value })} className={inputClass}>
              {[...new Set([hours.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone, ...TIME_ZONES])].map(zone => <option key={zone}>{zone}</option>)}
            </select>
          </label>
          <NumberField label="AI answers by SMS per farmer per day" hint="Each answer costs SMS credit" value={form.smsAiDailyLimit} min={0} max={100}
            onChange={n => setForm({ ...form, smsAiDailyLimit: n })} />
        </div>
        <button type="button" onClick={() => void save()} disabled={saving}
          className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save farmer chat settings'}
        </button>
      </div>
    </div>
  );
};
