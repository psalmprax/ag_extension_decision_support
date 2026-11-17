import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchTurnTakingSettings, saveTurnTakingSettings, type TurnTakingSettings } from '@/api/chatbotService';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_ZONES = ['Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Africa/Kigali', 'Africa/Addis_Ababa',
  'Africa/Lagos', 'Africa/Accra', 'Africa/Johannesburg', 'Africa/Lusaka', 'Africa/Blantyre', 'Africa/Harare', 'UTC'];

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white';

function NumberField({ label, hint, value, min, max, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-gray-500">
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
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['chat-turn-taking'], queryFn: fetchTurnTakingSettings });
  const [form, setForm] = useState<TurnTakingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);

  if (isLoading || !form) {
    return <p className="text-sm text-gray-500">Loading farmer chat settings…</p>;
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
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Farmer chat: officer and AI
      </h3>
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Farmers can ask the AI at any time. If their officer has not replied within the wait time during working hours, or it is
          outside working hours, the AI answers and the officer is notified.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Wait for the officer (minutes)" hint="Before the AI answers" value={form.aiFallbackMinutes} min={1} max={1440}
            onChange={n => setForm({ ...form, aiFallbackMinutes: n })} />
          <NumberField label="AI holds back after an officer reply (minutes)" hint="The farmer can still tap Ask AI" value={form.aiPauseAfterOfficerMinutes} min={0} max={1440}
            onChange={n => setForm({ ...form, aiPauseAfterOfficerMinutes: n })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-gray-500">Working hours start
            <input type="time" value={hours.start} onChange={e => setHours({ start: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-gray-500">Working hours end
            <input type="time" value={hours.end} onChange={e => setHours({ end: e.target.value })} className={inputClass} />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-semibold text-gray-500">Working days</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((label, day) => (
              <button key={label} type="button" aria-pressed={hours.days.includes(day)} onClick={() => toggleDay(day)}
                className={`px-2.5 py-1 rounded-lg text-xs border ${hours.days.includes(day)
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-gray-500">Time zone
            <select value={hours.timezone} onChange={e => setHours({ timezone: e.target.value })} className={inputClass}>
              {[...new Set([hours.timezone, ...TIME_ZONES])].map(zone => <option key={zone}>{zone}</option>)}
            </select>
          </label>
          <NumberField label="AI answers by SMS per farmer per day" hint="Each answer costs SMS credit" value={form.smsAiDailyLimit} min={0} max={100}
            onChange={n => setForm({ ...form, smsAiDailyLimit: n })} />
        </div>
        <button type="button" onClick={() => void save()} disabled={saving}
          className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save farmer chat settings'}
        </button>
      </div>
    </div>
  );
};
