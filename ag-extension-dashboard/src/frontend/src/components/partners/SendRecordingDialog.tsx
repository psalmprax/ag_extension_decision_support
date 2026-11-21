import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { fetchFarmers, type Farmer } from '@/api/farmerService';
import { getApiErrorMessage } from '@/lib/apiError';
import { sendRecording, type PartnerRecording } from './partnersApi';

/** Choose farmers you serve and send them a recording; it arrives in their thread, SMS or WhatsApp. */
export function SendRecordingDialog({ recording, onClose, onSent }: { recording: PartnerRecording; onClose: () => void; onSent: () => void }) {
  const [farmers, setFarmers] = useState<Farmer[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchFarmers()
      .then(response => setFarmers(response.data?.farmers ?? []))
      .catch((error: unknown) => setFailed(getApiErrorMessage(error, 'Could not load your farmers.')));
  }, []);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (farmers ?? []).filter(f => !needle || `${f.firstName} ${f.lastName} ${f.village ?? ''}`.toLowerCase().includes(needle));
  }, [farmers, filter]);

  const toggle = (id: string) => setChosen(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const send = async () => {
    setSending(true);
    try {
      const result = await sendRecording(recording.id, Array.from(chosen));
      toast.success(`Sent to ${result.sent} farmer${result.sent === 1 ? '' : 's'}${result.skipped ? `; ${result.skipped} skipped` : ''}.`);
      onSent();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not send the recording. Try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} size="md">
      <DialogTitle>Send “{recording.title}”</DialogTitle>
      <DialogDescription>
        It arrives in each farmer’s thread with the audio, and by SMS or WhatsApp with a link to play it.
      </DialogDescription>
      <DialogContent className="space-y-3">
        <Input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Find a farmer by name or village" aria-label="Find a farmer" />
        {failed && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{failed}</p>}
        {!farmers && !failed && <p className="text-sm text-slate-500 dark:text-white/60">Loading your farmers…</p>}
        {farmers && shown.length === 0 && <p className="text-sm text-slate-500 dark:text-white/60">No farmers match.</p>}
        <ul className="max-h-72 overflow-y-auto divide-y divide-slate-900/[0.08] dark:divide-white/[0.08]" tabIndex={0} aria-label="Farmers">
          {shown.map(farmer => (
            <li key={farmer.id}>
              <label className="flex items-center gap-3 py-2 text-sm text-slate-800 dark:text-white/80 cursor-pointer">
                <input type="checkbox" checked={chosen.has(farmer.id)} onChange={() => toggle(farmer.id)} className="w-4 h-4" />
                <span className="truncate">{farmer.firstName} {farmer.lastName}</span>
                <span className="text-xs text-slate-500 dark:text-white/50 truncate">{farmer.village}</span>
              </label>
            </li>
          ))}
        </ul>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void send()} disabled={chosen.size === 0 || sending}>
          {sending ? 'Sending…' : `Send to ${chosen.size || ''} farmer${chosen.size === 1 ? '' : 's'}`.replace('  ', ' ')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
