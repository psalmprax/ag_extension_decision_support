import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { getApiErrorMessage } from '@/lib/apiError';
import { RecordingCredit } from './RecordingCredit';
import { listRecordings, reviewRecording, type PartnerRecording } from './partnersApi';

const TRANSCRIPT_NOTE: Record<PartnerRecording['transcriptStatus'], string> = {
  pending: 'Not transcribed yet: type what is said, or wait for the speech service.',
  transcribed: 'Machine transcript: check it against the audio before approving.',
  failed: 'Transcription failed: type what is said.',
};

/** One draft: listen, correct the transcript, approve or reject. */
function DraftRow({ recording, onDone }: { recording: PartnerRecording; onDone: (id: string) => void }) {
  const [transcript, setTranscript] = useState(recording.transcript ?? '');
  const [saving, setSaving] = useState(false);
  const decide = async (decision: 'approve' | 'reject') => {
    setSaving(true);
    try {
      await reviewRecording(recording.id, decision, decision === 'approve' ? transcript : undefined);
      toast.success(decision === 'approve' ? 'Approved. The assistant can now use it, and officers can send it.' : 'Rejected. It will not be used.');
      onDone(recording.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the review. Try again.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="py-4 space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{recording.title}</p>
        <RecordingCredit recording={recording} />
      </div>
      <audio controls preload="none" src={recording.url} className="w-full max-w-md" aria-label={`Play ${recording.title}`} />
      <label className="block text-xs text-slate-600 dark:text-white/60" htmlFor={`transcript-${recording.id}`}>
        {TRANSCRIPT_NOTE[recording.transcriptStatus]}
      </label>
      <Textarea id={`transcript-${recording.id}`} rows={4} value={transcript} onChange={event => setTranscript(event.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={saving || transcript.trim().length < 20} onClick={() => void decide('approve')}>
          <Check className="w-4 h-4" aria-hidden="true" /> Approve
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => void decide('reject')}>
          <X className="w-4 h-4" aria-hidden="true" /> Reject
        </Button>
      </div>
    </li>
  );
}

/** Recordings waiting for an administrator or regional manager to check. */
export function RecordingReviewList({ refreshKey }: { refreshKey: number }) {
  const [drafts, setDrafts] = useState<PartnerRecording[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setDrafts(await listRecordings({ status: 'pending_review' }));
      setFailed(null);
    } catch (error) {
      setFailed(getApiErrorMessage(error, 'Could not load recordings waiting for review.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  if (failed) return <p className="text-sm text-red-700 dark:text-red-300" role="alert">{failed}</p>;
  if (!drafts) return <p className="text-sm text-slate-500 dark:text-white/60">Loading recordings waiting for review…</p>;
  if (drafts.length === 0) return <p className="text-sm text-slate-500 dark:text-white/60">No recordings are waiting for review.</p>;
  return (
    <ul className="divide-y divide-slate-900/[0.08] dark:divide-white/[0.08]">
      {drafts.map(recording => (
        <DraftRow key={recording.id} recording={recording} onDone={id => setDrafts(current => (current ?? []).filter(r => r.id !== id))} />
      ))}
    </ul>
  );
}
