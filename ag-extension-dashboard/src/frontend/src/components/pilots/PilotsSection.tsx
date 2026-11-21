import { useCallback, useEffect, useState } from 'react';
import { Download, Play, Plus, Square, Wheat } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { PilotForm } from './PilotForm';
import { PilotResults } from './PilotResults';
import { askHarvest, closePilot, downloadPilotCsv, fetchPilot, fetchPilots, serverMessage, startPilot, type Pilot, type PilotDetail } from './pilotsApi';

const CARD = 'bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 space-y-4';
const BUTTON = 'h-9 px-3 inline-flex items-center gap-2 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] text-sm text-slate-800 dark:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50';

/**
 * Pilots measure whether the service helps: farmers in a region are split at random into a
 * service group and a comparison group, and their harvests before and after are compared.
 */
export function PilotsSection() {
  const { t } = useLanguage();
  const role = useAppStore(state => state.user?.role);
  const allowed = role === 'admin' || role === 'regional_manager';
  const [pilots, setPilots] = useState<Pilot[] | null>(null);
  const [selected, setSelected] = useState<PilotDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (focusId?: string) => {
    try {
      const list = await fetchPilots();
      setPilots(list);
      const id = focusId ?? list[0]?.id;
      setSelected(id ? await fetchPilot(id) : null);
    } catch {
      setPilots([]);
      toast.error(t('pilot_load_failed', { defaultValue: 'Could not load pilots.' }));
    }
  }, [t]);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);
  if (!allowed) return null;

  const act = async (work: () => Promise<string>) => {
    try {
      toast.success(await work());
      if (selected) await load(selected.pilot.id);
    } catch (error) {
      toast.error(serverMessage(error) ?? t('pilot_action_failed', { defaultValue: 'That did not work. Try again.' }));
    }
  };
  const pilot = selected?.pilot;

  return (
    <section className={CARD} aria-labelledby="pilots-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="pilots-heading" className="text-base font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Wheat className="w-4 h-4 text-slate-500" aria-hidden="true" />
            {t('pilot_heading', { defaultValue: 'Pilots: does the service raise harvests?' })}
          </h2>
          <p className="text-sm text-slate-600 dark:text-white/70 max-w-3xl">
            {t('pilot_intro', { defaultValue: 'Farmers in a region are split at random into a service group and a comparison group. Both are asked for last season’s and this season’s harvest by SMS, and service-group farmers are asked whether they followed their officer’s advice.' })}
          </p>
        </div>
        <button type="button" className={BUTTON} onClick={() => setCreating(value => !value)}>
          <Plus className="w-4 h-4" aria-hidden="true" />{t('pilot_new', { defaultValue: 'New pilot' })}
        </button>
      </div>

      {creating && <PilotForm onCreated={created => { setCreating(false); void load(created.id); }} />}

      {pilots && pilots.length > 1 && (
        <label className="block text-sm text-slate-700 dark:text-white/80">{t('pilot_choose', { defaultValue: 'Pilot' })}
          <select value={pilot?.id ?? ''} onChange={event => { void fetchPilot(event.target.value).then(setSelected); }}
            className="mt-1 h-10 w-full max-w-md px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm">
            {pilots.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}

      {pilots?.length === 0 && !creating && (
        <p className="text-sm text-slate-600 dark:text-white/70">{t('pilot_none', { defaultValue: 'No pilots yet. Create one for a region and a season.' })}</p>
      )}

      {pilot && selected && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-white/80">
            {t('pilot_summary', {
              region: pilot.region, crop: pilot.crop, start: pilot.season_start.slice(0, 10), end: pilot.season_end.slice(0, 10),
              defaultValue: '{region}, {crop}, {start} to {end}.',
            })} <span className="text-slate-500">{{
              draft: t('pilot_status_draft', { defaultValue: 'Not started' }),
              running: t('pilot_status_running', { defaultValue: 'Running' }),
              closed: t('pilot_status_closed', { defaultValue: 'Closed' }),
            }[pilot.status]}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {pilot.status === 'draft' && (
              <button type="button" className={BUTTON} onClick={() => act(async () => {
                const split = await startPilot(pilot.id);
                return t('pilot_started', { service: split.service, comparison: split.comparison, defaultValue: 'Started: {service} farmers in the service group, {comparison} in the comparison group.' });
              })}><Play className="w-4 h-4" aria-hidden="true" />{t('pilot_start', { defaultValue: 'Start and split farmers' })}</button>
            )}
            {pilot.status === 'running' && (['baseline', 'endline'] as const).map(which => (
              <button key={which} type="button" className={BUTTON} onClick={() => act(async () => {
                const counts = await askHarvest(pilot.id, which);
                return t('pilot_asked', { sent: counts.sent, skipped: counts.opted_out + counts.no_contact + counts.failed, defaultValue: 'Asked {sent} farmers. {skipped} could not be reached or turned notices off.' });
              })}>{which === 'baseline'
                ? t('pilot_ask_baseline', { defaultValue: 'Ask for last season’s harvest' })
                : t('pilot_ask_endline', { defaultValue: 'Ask for this season’s harvest' })}</button>
            ))}
            {pilot.status === 'running' && (
              <button type="button" className={BUTTON} onClick={() => act(async () => { await closePilot(pilot.id); return t('pilot_closed', { defaultValue: 'Pilot closed.' }); })}>
                <Square className="w-4 h-4" aria-hidden="true" />{t('pilot_close', { defaultValue: 'Close pilot' })}
              </button>
            )}
            <button type="button" className={BUTTON} onClick={() => { void downloadPilotCsv(pilot).catch(() => toast.error(t('pilot_export_failed', { defaultValue: 'Could not download the file.' }))); }}>
              <Download className="w-4 h-4" aria-hidden="true" />{t('pilot_export', { defaultValue: 'Data for the evaluator (CSV, no names)' })}
            </button>
          </div>
          {pilot.status !== 'draft' && <PilotResults detail={selected} />}
        </div>
      )}
    </section>
  );
}
