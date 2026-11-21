import { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { AddTestPhotos } from './AddTestPhotos';
import { ImportPhotoArchive } from './ImportPhotoArchive';
import { classState, fetchMistakes, fetchTestOverview, startTestRun, type ClassState, type TestMistake, type TestOverview } from './diagnosisTestsApi';

const CARD = 'p-5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] space-y-4';
const STATE_STYLE: Record<ClassState, string> = {
  tested: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200',
  below_threshold: 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200',
  not_tested: 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-white/70',
  needs_photos: 'bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200',
};

/**
 * Photo diagnosis tested on photos with a known answer. A diagnosis reaches farmers as
 * "tested" only for a crop and problem with enough photos, enough of them right; every
 * other diagnosis is marked for the officer to confirm.
 */
export function DiagnosisTestingTab() {
  const { t } = useLanguage();
  const [overview, setOverview] = useState<TestOverview | null>(null);
  const [mistakes, setMistakes] = useState<TestMistake[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTestOverview();
      setOverview(data);
      setFailed(false);
      const finished = data.runs.find(run => run.status === 'finished');
      setMistakes(finished ? await fetchMistakes(finished.id) : []);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const running = overview?.runs.find(run => run.status === 'running');
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [running, load]);

  const run = async () => {
    try {
      const started = await startTestRun();
      toast.success(t('diag_test_started', { total: started.total, defaultValue: 'Testing {total} photos. Each one is an AI request.' }));
      void load();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? t('diag_test_start_failed', { defaultValue: 'Could not start the test.' }));
    }
  };

  if (failed) return <p className="text-sm text-red-700 dark:text-red-300">{t('diag_test_load_failed', { defaultValue: 'Could not load the test set.' })}</p>;
  if (!overview) return <p className="text-sm text-slate-500" role="status">{t('diag_test_loading', { defaultValue: 'Loading the test set…' })}</p>;
  const { minSamples, minAccuracy } = overview.thresholds;
  const stateLabel: Record<ClassState, string> = {
    tested: t('diag_state_tested', { defaultValue: 'Shown to farmers as tested' }),
    below_threshold: t('diag_state_below', { defaultValue: 'Too many wrong: officer confirms' }),
    not_tested: t('diag_state_not_tested', { defaultValue: 'Not run yet' }),
    needs_photos: t('diag_state_needs_photos', { defaultValue: 'Needs more photos' }),
  };

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <p className="text-sm text-slate-700 dark:text-white/80 max-w-3xl">
          {t('diag_test_intro', {
            samples: minSamples, accuracy: Math.round(minAccuracy * 100),
            defaultValue: 'A diagnosis is shown to farmers as tested only for a crop and problem with at least {samples} labelled photos, at least {accuracy}% of them diagnosed right. Every other diagnosis is marked for the officer to confirm. Officers add photos from farmers’ threads once they have confirmed the problem in the field.',
          })}
        </p>
        <AddTestPhotos onAdded={() => { void load(); }} />
        <ImportPhotoArchive onAdded={() => { void load(); }} />
      </section>

      <section className={CARD} aria-labelledby="diag-classes-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="diag-classes-heading" className="text-sm font-medium text-slate-900 dark:text-white">{t('diag_test_classes', { defaultValue: 'Crops and problems in the test set' })}</h3>
          <button type="button" onClick={() => { void run(); }} disabled={Boolean(running) || overview.classes.length === 0}
            className="h-9 px-3 inline-flex items-center gap-2 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] text-sm text-slate-800 dark:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50">
            <Play className="w-4 h-4" aria-hidden="true" />
            {running
              ? t('diag_test_running', { done: running.done, total: running.total, defaultValue: 'Testing {done} of {total}…' })
              : t('diag_test_run', { defaultValue: 'Run the test' })}
          </button>
        </div>
        {overview.classes.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-white/70">{t('diag_test_empty', { defaultValue: 'No labelled photos yet. Add some above.' })}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-start text-slate-500 dark:text-white/60">
                <tr>
                  <th className="py-2 pe-4 text-start font-normal">{t('diag_label_crop', { defaultValue: 'Crop' })}</th>
                  <th className="py-2 pe-4 text-start font-normal">{t('diag_col_problem', { defaultValue: 'Problem' })}</th>
                  <th className="py-2 pe-4 text-end font-normal">{t('diag_col_photos', { defaultValue: 'Photos' })}</th>
                  <th className="py-2 pe-4 text-end font-normal">{t('diag_col_right', { defaultValue: 'Right' })}</th>
                  <th className="py-2 text-start font-normal">{t('diag_col_status', { defaultValue: 'Status' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
                {overview.classes.map(row => {
                  const state = classState(row, minSamples, minAccuracy);
                  return (
                    <tr key={`${row.crop}|${row.label}`}>
                      <td className="py-2 pe-4 capitalize">{row.crop}</td>
                      <td className="py-2 pe-4">{row.label}</td>
                      <td className="py-2 pe-4 text-end tabular-nums">{row.photos}{row.fieldConfirmed ? <span className="text-slate-500"> ({row.fieldConfirmed} field)</span> : null}</td>
                      <td className="py-2 pe-4 text-end tabular-nums">{row.tested ? `${row.correct}/${row.tested} (${Math.round(((row.correct ?? 0) / row.tested) * 100)}%)` : '—'}</td>
                      <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${STATE_STYLE[state]}`}>{stateLabel[state]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mistakes.length > 0 && (
        <section className={CARD} aria-labelledby="diag-mistakes-heading">
          <h3 id="diag-mistakes-heading" className="text-sm font-medium text-slate-900 dark:text-white">{t('diag_test_mistakes', { defaultValue: 'Photos the last test got wrong' })}</h3>
          <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {mistakes.map(item => (
              <li key={item.imageId} className="text-xs space-y-1">
                <img src={item.url} alt={`${item.crop}, ${item.label}`} loading="lazy" className="w-full aspect-square object-cover rounded-md bg-slate-100 dark:bg-slate-800" />
                <p className="text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-slate-500 dark:text-white/60">{t('diag_test_said', { predicted: item.predicted ?? '—', defaultValue: 'Said: {predicted}' })}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
