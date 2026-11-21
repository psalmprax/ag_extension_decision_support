import { useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { labelPhoto } from './diagnosisTestsApi';

const FIELD =
  'h-9 w-full px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';

/**
 * An officer who has confirmed the problem in the field records what the photo shows.
 * Those photos test photo diagnosis, so it is only trusted for problems it gets right.
 */
export function LabelPhotoForm({ uploadId }: { uploadId: string }) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState('');
  const [label, setLabel] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await labelPhoto({ uploadId, crop, label });
      setSaved(true);
    } catch {
      toast.error(t('diag_label_failed', { defaultValue: 'Could not save what the photo shows. Try again.' }));
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300" role="status">
        <Check className="w-4 h-4" aria-hidden="true" />
        {t('diag_label_saved', { defaultValue: 'Saved. This photo now helps test photo diagnosis.' })}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-end px-4 py-3 border-t border-slate-900/[0.08] dark:border-white/[0.08]"
      aria-label={t('diag_label_form', { defaultValue: 'What this photo shows' })}>
      <label className="text-xs text-slate-600 dark:text-white/70">
        {t('diag_label_crop', { defaultValue: 'Crop' })}
        <input value={crop} onChange={event => setCrop(event.target.value)} required minLength={2} className={`${FIELD} mt-1`} />
      </label>
      <label className="text-xs text-slate-600 dark:text-white/70">
        {t('diag_label_problem', { defaultValue: 'Problem you confirmed in the field (or healthy)' })}
        <input value={label} onChange={event => setLabel(event.target.value)} required minLength={2} className={`${FIELD} mt-1`} />
      </label>
      <button type="submit" disabled={busy}
        className="h-9 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] text-sm text-slate-800 dark:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50">
        {t('diag_label_save', { defaultValue: 'Save' })}
      </button>
    </form>
  );
}
