import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { getApiErrorMessage } from '@/lib/apiError';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';

interface PinStatus {
  hasPin: boolean;
  locked: boolean;
  phone: string | null;
}

const INPUT =
  'w-full h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';

/** The PIN that lets officers and managers use SMS commands from their phone number. */
/** The officer SMS commands, as typed. Kept in step with the backend's command table. */
const SMS_COMMANDS: Array<{ code: string; key: string; does: string }> = [
  { code: 'INBOX', key: 'sms_cmd_inbox', does: 'The three newest unanswered farmer messages, numbered' },
  { code: 'R 12 <reply>', key: 'sms_cmd_reply', does: 'Reply to farmer 12' },
  { code: 'FIND <name>', key: 'sms_cmd_find', does: 'Look up one of your farmers' },
  { code: 'VISIT 12 <notes>', key: 'sms_cmd_visit', does: 'Record a visit to farmer 12 today' },
  { code: 'PLAN 12 <date> <notes>', key: 'sms_cmd_plan', does: 'Schedule a visit: today, tomorrow, Tue or 25/11' },
  { code: 'ASK AI <question>', key: 'sms_cmd_ask', does: 'Ask the AI agronomist' },
  { code: 'LOCK', key: 'sms_cmd_lock', does: 'Turn commands off until you send your PIN again' },
];

export const SmsCommandsSection: React.FC<{ active: boolean }> = ({ active }) => {
  const { t } = useLanguage();
  const role = useAppStore(state => state.user?.role);
  const isStaff = role === 'extension_officer' || role === 'regional_manager';
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!active || !isStaff) return;
    apiClient
      .get<{ data: PinStatus }>('/account/sms-pin')
      .then(response => setStatus(response.data.data))
      .catch(() => setStatus(null));
  }, [active, isStaff]);

  if (!isStaff) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await apiClient.put('/account/sms-pin', { pin, currentPassword: password });
      toast.success(t('sms_pin_saved', { defaultValue: 'SMS PIN saved' }));
      setStatus(current => (current ? { ...current, hasPin: true, locked: false } : current));
      setPin('');
      setPassword('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sms_pin_failed', { defaultValue: 'Could not save the SMS PIN' })));
    } finally {
      setSaving(false);
    }
  };

  const state = !status
    ? ''
    : status.locked
      ? t('sms_pin_locked', { defaultValue: 'Locked after too many wrong PINs. Set a new PIN to unlock.' })
      : status.hasPin
        ? t('sms_pin_set', { defaultValue: 'A PIN is set.' })
        : t('sms_pin_none', { defaultValue: 'No PIN set yet.' });

  return (
    <section className="space-y-3" aria-labelledby="sms-commands-heading">
      <h3 id="sms-commands-heading" className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
        {t('sms_commands_title', { defaultValue: 'SMS commands' })}
      </h3>
      <div className="p-4 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] space-y-3">
        <p className="text-sm text-slate-600 dark:text-white/70">
          {t('sms_commands_intro', {
            phone: status?.phone ?? '—',
            defaultValue: 'From {phone}, send PIN and your 4 digits once a day, then text any of these:',
          })}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {SMS_COMMANDS.map(command => (
            <React.Fragment key={command.code}>
              <dt>
                <code className="text-[13px] text-slate-900 dark:text-white">{command.code}</code>
              </dt>
              <dd className="text-slate-600 dark:text-white/70">{t(command.key, { defaultValue: command.does })}</dd>
            </React.Fragment>
          ))}
        </dl>
        {state && <p className="text-sm text-slate-900 dark:text-white" aria-live="polite">{state}</p>}
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-600 dark:text-white/70">
            {t('sms_pin_new', { defaultValue: 'New 4-digit PIN' })}
            <input
              className={`${INPUT} mt-1 tabular-nums`}
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              autoComplete="off"
              value={pin}
              onChange={event => setPin(event.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="text-sm text-slate-600 dark:text-white/70">
            {t('sms_pin_password', { defaultValue: 'Your password' })}
            <input
              className={`${INPUT} mt-1`}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={saving || pin.length !== 4} className={`${PRIMARY_BUTTON} sm:col-span-2 sm:justify-self-start`}>
            {status?.hasPin ? t('sms_pin_change', { defaultValue: 'Change PIN' }) : t('sms_pin_save', { defaultValue: 'Set PIN' })}
          </button>
        </form>
      </div>
    </section>
  );
};
