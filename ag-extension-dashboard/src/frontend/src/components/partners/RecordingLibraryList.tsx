import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getApiErrorMessage } from '@/lib/apiError';
import { RecordingCredit } from './RecordingCredit';
import { SendRecordingDialog } from './SendRecordingDialog';
import { listRecordings, type PartnerRecording } from './partnersApi';

/** Approved recordings, to listen to and send. `load` lets a farmer's page show only theirs. */
export function RecordingLibraryList({ refreshKey = 0, load: loadFn, emptyText }: {
  refreshKey?: number;
  load?: () => Promise<PartnerRecording[]>;
  emptyText?: string;
}) {
  const [language, setLanguage] = useState('');
  const [crop, setCrop] = useState('');
  const [recordings, setRecordings] = useState<PartnerRecording[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [sending, setSending] = useState<PartnerRecording | null>(null);

  const load = useCallback(async () => {
    try {
      setRecordings(await (loadFn ? loadFn() : listRecordings({ status: 'approved', language, crop })));
      setFailed(null);
    } catch (error) {
      setFailed(getApiErrorMessage(error, 'Could not load the recordings.'));
    }
  }, [loadFn, language, crop]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <div className="space-y-3">
      {!loadFn && (
        <div className="flex flex-wrap gap-2">
          <Input className="w-28" value={language} onChange={e => setLanguage(e.target.value)} placeholder="Language" aria-label="Filter by language code" />
          <Input className="w-40" value={crop} onChange={e => setCrop(e.target.value)} placeholder="Crop" aria-label="Filter by crop" />
        </div>
      )}
      {failed && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{failed}</p>}
      {!recordings && !failed && <p className="text-sm text-slate-500 dark:text-white/60">Loading recordings…</p>}
      {recordings?.length === 0 && <p className="text-sm text-slate-500 dark:text-white/60">{emptyText ?? 'No approved recordings match yet.'}</p>}
      <ul className="divide-y divide-slate-900/[0.08] dark:divide-white/[0.08]">
        {recordings?.map(recording => (
          <li key={recording.id} className="py-3 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{recording.title}</p>
                <RecordingCredit recording={recording} />
                <p className="text-xs text-slate-500 dark:text-white/50 tabular-nums">Sent to {recording.deliveries} farmer{recording.deliveries === 1 ? '' : 's'}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSending(recording)}>
                <Send className="w-4 h-4" aria-hidden="true" /> Send to farmers
              </Button>
            </div>
            <audio controls preload="none" src={recording.url} className="w-full max-w-md" aria-label={`Play ${recording.title}`} />
          </li>
        ))}
      </ul>
      {sending && <SendRecordingDialog recording={sending} onClose={() => setSending(null)} onSent={() => void load()} />}
    </div>
  );
}
