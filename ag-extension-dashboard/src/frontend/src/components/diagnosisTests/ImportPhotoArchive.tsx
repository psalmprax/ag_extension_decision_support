import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { importPhotoArchive } from './diagnosisTestsApi';

/** Load a whole labelled set at once: a zip whose folders name the crop and the problem. */
export function ImportPhotoArchive({ onAdded }: { onAdded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<Array<{ file: string; reason: string }>>([]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const report = await importPhotoArchive(file);
      setSkipped(report.skipped);
      toast.success(`${report.imported} labelled photo${report.imported === 1 ? '' : 's'} added.`);
      onAdded();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not import the archive.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600 dark:text-white/60">
        Or import a zip of an agronomist’s labelled set, sorted as <code>crop/problem/photo.jpg</code> (for example{' '}
        <code>maize/fall_armyworm/IMG_001.jpg</code>). The folder names become the labels.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".zip,application/zip" aria-label="Labelled photo archive" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        <Button size="sm" variant="secondary" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Importing…' : 'Import archive'}</Button>
      </div>
      {skipped.length > 0 && (
        <details className="text-xs text-slate-700 dark:text-white/70">
          <summary>{skipped.length} file{skipped.length === 1 ? '' : 's'} not imported</summary>
          <ul className="mt-1 space-y-0.5">{skipped.map(s => <li key={s.file}><code>{s.file}</code>: {s.reason}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
