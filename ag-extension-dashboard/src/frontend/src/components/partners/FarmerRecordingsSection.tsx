import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { getApiErrorMessage } from '@/lib/apiError';
import { RecordingCredit } from './RecordingCredit';
import { recordingsForFarmer, sendRecording, type PartnerRecording } from './partnersApi';

/** Approved partner recordings in this farmer's language that fit their crops and region. */
export function FarmerRecordingsSection({ farmerId, farmerName }: { farmerId: string; farmerName: string }) {
  const role = useAppStore(state => state.user?.role);
  const [recordings, setRecordings] = useState<PartnerRecording[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const staff = role === 'admin' || role === 'regional_manager' || role === 'extension_officer';

  const load = useCallback(async () => {
    try {
      setRecordings(await recordingsForFarmer(farmerId));
      setFailed(null);
    } catch (error) {
      setFailed(getApiErrorMessage(error, 'Could not load recordings for this farmer.'));
    }
  }, [farmerId]);
  useEffect(() => { if (staff) void load(); }, [load, staff]);
  if (!staff || (recordings && recordings.length === 0 && !failed)) return null;

  const send = async (recording: PartnerRecording) => {
    setSending(recording.id);
    try {
      const result = await sendRecording(recording.id, [farmerId]);
      if (result.sent) toast.success(`Sent “${recording.title}” to ${farmerName}.`);
      else toast.error(`${farmerName} could not be reached for this recording.`);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not send the recording. Try again.'));
    } finally {
      setSending(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3" aria-labelledby={`recordings-${farmerId}`}>
      <h3 id={`recordings-${farmerId}`} className="text-sm font-medium text-white">Recordings for {farmerName}</h3>
      {failed && <p className="text-xs text-rose-300" role="alert">{failed}</p>}
      {!recordings && !failed && <p className="text-xs text-slate-400">Finding recordings in their language…</p>}
      <ul className="space-y-3">
        {recordings?.map(recording => (
          <li key={recording.id} className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-white">{recording.title}</p>
                <div className="[&_p]:text-slate-400"><RecordingCredit recording={recording} /></div>
              </div>
              <Button size="sm" variant="secondary" disabled={sending === recording.id} onClick={() => void send(recording)}>
                <Send className="w-4 h-4" aria-hidden="true" /> {sending === recording.id ? 'Sending…' : 'Send'}
              </Button>
            </div>
            <audio controls preload="none" src={recording.url} className="w-full" aria-label={`Play ${recording.title}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
