import { useState } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { uploadFile } from '@/api/uploadService';
import { labelPhoto } from './diagnosisTestsApi';

const FIELD =
  'h-10 w-full px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';

/** Photos of one crop and one problem, labelled by an agronomist, added to the test set together. */
export function AddTestPhotos({ onAdded }: { onAdded: () => void }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [crop, setCrop] = useState('');
  const [label, setLabel] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    let added = 0;
    setProgress(0);
    for (const file of files) {
      try {
        const uploaded = await uploadFile(file);
        if (uploaded.id) {
          await labelPhoto({ uploadId: uploaded.id, crop, label });
          added += 1;
        }
      } catch {
        // One unreadable or oversized photo does not stop the rest; the count below says how many went in.
      }
      setProgress(previous => (previous ?? 0) + 1);
    }
    setProgress(null);
    setFiles([]);
    if (added === files.length) toast.success(t('diag_test_added', { count: added, defaultValue: '{count} photos added.' }));
    else toast.error(t('diag_test_partly_added', { added, total: files.length, defaultValue: '{added} of {total} photos added. The others could not be uploaded.' }));
    onAdded();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label={t('diag_test_add', { defaultValue: 'Add labelled photos' })}>
      <label className="text-sm text-slate-700 dark:text-white/80 sm:col-span-2">
        {t('diag_test_files', { defaultValue: 'Photos of one crop with one problem, confirmed by an agronomist' })}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple required
          onChange={event => setFiles(Array.from(event.target.files ?? []))}
          className="mt-1 block w-full text-sm text-slate-700 dark:text-white/80" />
      </label>
      <label className="text-sm text-slate-700 dark:text-white/80">
        {t('diag_label_crop', { defaultValue: 'Crop' })}
        <input value={crop} onChange={event => setCrop(event.target.value)} required minLength={2} className={`${FIELD} mt-1`} />
      </label>
      <label className="text-sm text-slate-700 dark:text-white/80">
        {t('diag_test_label', { defaultValue: 'What they show (or healthy)' })}
        <input value={label} onChange={event => setLabel(event.target.value)} required minLength={2} className={`${FIELD} mt-1`} />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={files.length === 0 || progress !== null}
          className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">
          <Upload className="w-4 h-4" aria-hidden="true" />
          {t('diag_test_add', { defaultValue: 'Add labelled photos' })}
        </button>
        {progress !== null && (
          <span className="text-sm text-slate-600 dark:text-white/70 tabular-nums" role="status">
            {t('diag_test_uploading', { done: progress, total: files.length, defaultValue: 'Uploading {done} of {total}…' })}
          </span>
        )}
      </div>
    </form>
  );
}
