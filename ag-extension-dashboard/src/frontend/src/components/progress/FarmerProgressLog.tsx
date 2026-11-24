import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchProgress, recordProgress, type ProgressKind } from '@/api/progressService';
import { uploadFile } from '@/api/uploadService';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppStore } from '@/store/useAppStore';
import { MessagePhotos } from '@/components/chat/MessagePhotos';
import { calendarDateFromToday, formatCalendarDate } from '@/lib/calendarDate';
import { useLanguage } from '@/lib/LanguageContext';

const PROGRESS_KINDS: { value: ProgressKind; label: string; tone: string }[] = [
  { value: 'success', label: 'Success', tone: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: 'failure', label: 'Failure', tone: 'text-rose-700 dark:text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { value: 'field_event', label: 'Field event', tone: 'text-slate-700 dark:text-theme-text-secondary border-slate-500/30 bg-slate-500/10' },
  { value: 'action', label: 'Action taken', tone: 'text-amber-800 dark:text-amber-300 border-amber-500/30 bg-amber-500/10' },
  { value: 'observation', label: 'Observation', tone: 'text-slate-700 dark:text-theme-text-secondary border-slate-500/30 bg-slate-500/10' },
];

const FIELD = 'w-full rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-theme-bg-primary px-3 py-2 text-sm text-slate-900 dark:text-theme-text-primary';

/** The form an officer uses to add to a farmer's progress log. */
const ProgressEntryForm: React.FC<{ farmerId: string; crops: string[] }> = ({ farmerId, crops }) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ProgressKind>('observation');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [crop, setCrop] = useState(crops[0] ?? '');
  const [occurredOn, setOccurredOn] = useState(calendarDateFromToday());
  const [photos, setPhotos] = useState<File[]>([]);

  const save = useMutation({
    mutationFn: async () => {
      const uploads = await Promise.all(photos.map(photo => uploadFile(photo, farmerId)));
      return recordProgress(farmerId, {
        kind,
        title: title.trim(),
        details: details.trim() || undefined,
        crop: crop.trim() || undefined,
        occurredOn,
        attachmentIds: uploads.map(upload => upload.id).filter((id): id is string => Boolean(id)),
      });
    },
    onSuccess: () => {
      toast.success('Progress recorded');
      setTitle('');
      setDetails('');
      setPhotos([]);
      void queryClient.invalidateQueries({ queryKey: ['farmer-progress', farmerId] });
    },
    onError: error => toast.error(getApiErrorMessage(error, 'Progress could not be recorded')),
  });

  return (
    <form
      aria-label="Record progress"
      onSubmit={e => {
        e.preventDefault();
        if (title.trim()) save.mutate();
      }}
      className="space-y-3 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-theme-bg-secondary p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
          <span>{t('ui_farmer_progress_log_type')}</span>
          <select value={kind} onChange={e => setKind(e.target.value as ProgressKind)} className={FIELD}>
            {PROGRESS_KINDS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
          <span>{t('ui_farmer_progress_log_date')}</span>
          <input type="date" value={occurredOn} max={calendarDateFromToday()} onChange={e => setOccurredOn(e.target.value)} className={FIELD} />
        </label>
      </div>
      <label className="block text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
        <span>{t('ui_farmer_progress_log_what_happened')}</span>
        <input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} className={FIELD}
          placeholder="e.g. Maize germination 92%, armyworm found in 3 of 20 plants" />
      </label>
      <label className="block text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
        <span>{t('ui_farmer_progress_log_details')}</span>
        <textarea value={details} rows={2} onChange={e => setDetails(e.target.value)} className={FIELD} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
          <span>{t('ui_goal_mode_campaign_modal_crop')}</span>
          <input value={crop} list="progress-crops" onChange={e => setCrop(e.target.value)} className={FIELD} />
          <datalist id="progress-crops">{crops.map(c => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
          <span>{t('ui_farmer_progress_log_photos_up_to_4')}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={e => setPhotos(Array.from(e.target.files ?? []).slice(0, 4))} className="text-xs" />
        </label>
      </div>
      <button type="submit" disabled={save.isPending || !title.trim()}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">
        {save.isPending ? 'Saving…' : 'Record progress'}
      </button>
    </form>
  );
};

/**
 * A farmer's progress log: successes and failures, field events, actions the
 * officer took and observations, newest first. Staff record entries; the
 * farmer can read their own log.
 */
export const FarmerProgressLog: React.FC<{ farmerId: string; crops?: string[] }> = ({ farmerId, crops = [] }) => {
  const { t } = useLanguage();
  const role = useAppStore(state => state.user?.role);
  const canRecord = role === 'extension_officer' || role === 'regional_manager' || role === 'admin';
  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['farmer-progress', farmerId],
    queryFn: () => fetchProgress(farmerId),
  });

  const counts = PROGRESS_KINDS.map(kind => ({ ...kind, count: entries.filter(e => e.kind === kind.value).length }));

  return (
    <section aria-label="Progress log" className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Progress summary">
        {counts.map(kind => (
          <span key={kind.value} className={`px-2 py-0.5 rounded-md border text-xs ${kind.tone}`}>
            {kind.label}: <span className="font-mono tabular-nums">{kind.count}</span>
          </span>
        ))}
      </div>
      {canRecord && <ProgressEntryForm farmerId={farmerId} crops={crops} />}
      {isLoading && <p className="text-xs text-slate-600 dark:text-theme-text-muted">{t('ui_farmer_progress_log_loading_progress')}</p>}
      {isError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{t('ui_farmer_progress_log_the_progress_log_could_not_be_loaded')}</p>}
      {!isLoading && !isError && entries.length === 0 && (
        <p className="text-xs text-slate-600 dark:text-theme-text-muted">{t('ui_farmer_progress_log_no_progress_recorded_yet')}</p>
      )}
      <ol className="space-y-3" aria-label="Progress entries">
        {entries.map(entry => {
          const kind = PROGRESS_KINDS.find(k => k.value === entry.kind) ?? PROGRESS_KINDS[4];
          return (
            <li key={entry.id} className="rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-theme-bg-secondary p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-md border ${kind.tone}`}>{kind.label}</span>
                <span className="font-mono text-slate-600 dark:text-theme-text-muted">{formatCalendarDate(entry.occurredOn)}</span>
              </div>
              <p className="text-sm text-slate-900 dark:text-theme-text-primary">{entry.title}</p>
              {entry.details && <p className="text-xs text-slate-700 dark:text-theme-text-secondary whitespace-pre-line">{entry.details}</p>}
              <p className="text-xxs text-slate-600 dark:text-theme-text-muted">
                {[entry.crop, entry.officerName && `recorded by ${entry.officerName}`].filter(Boolean).join(' · ')}
              </p>
              <MessagePhotos photos={entry.attachments} label={`Photo for ${entry.title}`} />
            </li>
          );
        })}
      </ol>
    </section>
  );
};
