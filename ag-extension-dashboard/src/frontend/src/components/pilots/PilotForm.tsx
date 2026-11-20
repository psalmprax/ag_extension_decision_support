import { useState } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { createPilot, serverMessage, type Pilot } from './pilotsApi';

const FIELD =
  'h-10 w-full px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';
const LABEL = 'text-sm text-slate-700 dark:text-white/80';

/** A new pilot: one region, one crop, one season. */
export function PilotForm({ onCreated }: { onCreated: (pilot: Pilot) => void }) {
  const { t } = useLanguage();
  const user = useAppStore(state => state.user);
  const [form, setForm] = useState({
    name: '', region: user?.region ?? '', crop: '', seasonStart: '', seasonEnd: '', bagKg: '90', comparisonPercent: '50',
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm(previous => ({ ...previous, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const pilot = await createPilot({
        name: form.name, region: form.region, crop: form.crop, seasonStart: form.seasonStart, seasonEnd: form.seasonEnd,
        country: user?.country ?? undefined, bagKg: Number(form.bagKg) || 90, comparisonShare: (Number(form.comparisonPercent) || 50) / 100,
      });
      onCreated(pilot);
    } catch (error) {
      toast.error(serverMessage(error) ?? t('pilot_create_failed', { defaultValue: 'Could not create the pilot.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('pilot_new', { defaultValue: 'New pilot' })}>
      <label className={`${LABEL} sm:col-span-2 lg:col-span-3`}>{t('pilot_name', { defaultValue: 'Name' })}
        <input value={form.name} onChange={set('name')} required minLength={3} className={`${FIELD} mt-1`} />
      </label>
      <label className={LABEL}>{t('pilot_region', { defaultValue: 'Region' })}
        <input value={form.region} onChange={set('region')} required readOnly={user?.role === 'regional_manager'} className={`${FIELD} mt-1`} />
      </label>
      <label className={LABEL}>{t('pilot_crop', { defaultValue: 'Crop' })}
        <input value={form.crop} onChange={set('crop')} required minLength={2} className={`${FIELD} mt-1`} />
      </label>
      <label className={LABEL}>{t('pilot_bag_kg', { defaultValue: 'Kg in one bag, as farmers count it' })}
        <input type="number" min={1} max={200} value={form.bagKg} onChange={set('bagKg')} className={`${FIELD} mt-1`} />
      </label>
      <label className={LABEL}>{t('pilot_season_start', { defaultValue: 'Season starts' })}
        <input type="date" value={form.seasonStart} onChange={set('seasonStart')} required className={`${FIELD} mt-1`} />
      </label>
      <label className={LABEL}>{t('pilot_season_end', { defaultValue: 'Season ends' })}
        <input type="date" value={form.seasonEnd} onChange={set('seasonEnd')} required className={`${FIELD} mt-1`} />
      </label>
      <label className={LABEL}>{t('pilot_comparison_percent', { defaultValue: 'Comparison group, % of farmers' })}
        <input type="number" min={20} max={80} value={form.comparisonPercent} onChange={set('comparisonPercent')} className={`${FIELD} mt-1`} />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy} className="h-10 px-4 rounded-md bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">
          {t('pilot_create', { defaultValue: 'Create pilot' })}
        </button>
      </div>
    </form>
  );
}
