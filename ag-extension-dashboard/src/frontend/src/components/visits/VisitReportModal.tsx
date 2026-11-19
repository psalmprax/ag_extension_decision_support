import React, { useState } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createVisit, updateVisit } from '@/api/visitService';
import { uploadFile } from '@/api/uploadService';
import { getApiErrorMessage } from '@/lib/apiError';
import { calendarDateFromToday } from '@/lib/calendarDate';

export interface VisitReportTarget {
  visitId: string;
  farmerId: string;
  farmerName: string;
}

interface VisitReportModalProps {
  target: VisitReportTarget;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const FIELD = 'w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white';
const LABEL = 'block text-xs font-medium text-slate-700 dark:text-white/70 mb-1';

/**
 * Completing a visit: what the officer found, what was done or advised, how
 * long they were on the farm (the server requires at least 10 minutes), photos
 * taken, and whether the farmer needs a follow-up — optionally scheduled now.
 */
export const VisitReportModal: React.FC<VisitReportModalProps> = ({ target, onClose, onSaved }) => {
  const [findings, setFindings] = useState('');
  const [actions, setActions] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [photos, setPhotos] = useState<File[]>([]);
  const [followUp, setFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(calendarDateFromToday(14));
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findings.trim()) return;
    setSaving(true);
    try {
      const uploads = await Promise.all(photos.map(photo => uploadFile(photo, target.farmerId)));
      await updateVisit(target.visitId, {
        status: 'completed',
        outcomes: findings.trim(),
        notes: actions.trim() || undefined,
        durationMinutes: minutes,
        followUpRequired: followUp,
        followUpDate: followUp ? followUpDate : null,
        attachmentIds: uploads.map(upload => upload.id).filter((id): id is string => Boolean(id)),
      });
      if (followUp && scheduleFollowUp) {
        await createVisit({
          farmer_id: target.farmerId,
          visit_type: 'follow_up',
          scheduled_at: new Date(`${followUpDate}T09:00:00`).toISOString(),
          notes: `Follow-up: ${findings.trim()}`.slice(0, 500),
        });
      }
      onSaved(followUp && scheduleFollowUp
        ? `Visit report saved for ${target.farmerName}; follow-up scheduled`
        : `Visit report saved for ${target.farmerName}`);
      onClose();
    } catch (error) {
      console.error('Saving the visit report failed:', error);
      toast.error(getApiErrorMessage(error, 'The visit report could not be saved'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-report-title"
        onSubmit={e => void submit(e)}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="visit-report-title" className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            Visit report: {target.farmerName}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close visit report" className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="visit-findings" className={LABEL}>Findings *</label>
          <textarea id="visit-findings" required rows={3} value={findings} onChange={e => setFindings(e.target.value)}
            placeholder="What you saw on the farm: crop stage, pests, disease, soil, water" className={FIELD} />
        </div>
        <div>
          <label htmlFor="visit-actions" className={LABEL}>Actions taken and advice given</label>
          <textarea id="visit-actions" rows={2} value={actions} onChange={e => setActions(e.target.value)} className={FIELD} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="visit-minutes" className={LABEL}>Time on farm (minutes)</label>
            <input id="visit-minutes" type="number" min={10} max={600} required value={minutes}
              onChange={e => setMinutes(Number(e.target.value))} className={FIELD} />
          </div>
          <div>
            <label htmlFor="visit-photos" className={LABEL}>Photos (up to 4)</label>
            <input id="visit-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple
              onChange={e => setPhotos(Array.from(e.target.files ?? []).slice(0, 4))} className="text-xs text-slate-700 dark:text-white/70" />
          </div>
        </div>

        <fieldset className="space-y-2 rounded-lg border border-slate-200 dark:border-white/10 p-3">
          <legend className="px-1 text-xs font-medium text-slate-700 dark:text-white/70">Follow-up</legend>
          <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-white/80">
            <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} />
            The farmer needs a follow-up
          </label>
          {followUp && (
            <>
              <div>
                <label htmlFor="visit-follow-up-date" className={LABEL}>Follow up by</label>
                <input id="visit-follow-up-date" type="date" required min={calendarDateFromToday(0)} value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)} className={FIELD} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-white/80">
                <input type="checkbox" checked={scheduleFollowUp} onChange={e => setScheduleFollowUp(e.target.checked)} />
                Schedule the follow-up visit on that date
              </label>
            </>
          )}
        </fieldset>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5">
            Cancel
          </button>
          <button type="submit" disabled={saving || !findings.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Complete visit'}
          </button>
        </div>
      </form>
    </div>
  );
};
