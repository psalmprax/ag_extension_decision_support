import React, { useEffect, useRef, useState } from 'react';
import { CloudOff, Loader2, Mic, Square } from 'lucide-react';
import { draftVisitReport, type VisitReportDraft } from '@/api/aiService';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { useLanguage } from '@/lib/LanguageContext';
import { voiceMessages } from '@/hooks/voiceMessages';

interface TalkTheVisitProps {
  /** Recordings made with no signal are kept for this visit and used when it is opened online. */
  visitId: string;
  /** `recordedAt`: when the officer spoke, so "come back in two weeks" counts from the visit. */
  onDraft: (draft: VisitReportDraft, recordedAt: number) => void;
  /** True from the start of a recording until its words are in the report. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * One recording fills the whole visit report. The words are sorted into findings and
 * actions on the server, using only the officer's own sentences; if that is not
 * possible everything goes under findings. Nothing is saved until the officer completes
 * the visit, so they check every field first.
 */
export const TalkTheVisit: React.FC<TalkTheVisitProps> = ({ visitId, onDraft, onBusyChange }) => {
  const { t, language } = useLanguage();
  const [drafting, setDrafting] = useState(false);
  const [heard, setHeard] = useState(0);
  const spoken = useRef<string[]>([]);
  const firstSpokenAt = useRef<number | null>(null);
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;

  const { isRecording, isTranscribing, recordingDuration, pendingCount, toggleRecording } = useFieldVoiceRecorder({
    language,
    preferServer: true,
    draftKey: `visit-talk:${visitId}`,
    messages: voiceMessages(t),
    onTranscriptChunk: (text, { recordedAt }) => {
      spoken.current.push(text);
      firstSpokenAt.current = Math.min(firstSpokenAt.current ?? recordedAt, recordedAt);
      setHeard(count => count + 1);
    },
  });

  // Draft once the officer has stopped and every piece of the recording is text.
  useEffect(() => {
    if (isRecording || isTranscribing || drafting || spoken.current.length === 0) return;
    const transcript = spoken.current.join(' ');
    const recordedAt = firstSpokenAt.current ?? Date.now();
    spoken.current = [];
    firstSpokenAt.current = null;
    setDrafting(true);
    draftVisitReport(transcript)
      .then(draft => onDraftRef.current(draft, recordedAt))
      .catch(err => {
        // The words are never lost: without the sorting they all go under findings.
        console.error('Drafting the visit report failed:', err);
        const unsorted = { findings: transcript, actions: '', minutesOnFarm: null, followUpRequired: null, followUpInDays: null, organised: false };
        onDraftRef.current(unsorted, recordedAt);
      })
      .finally(() => setDrafting(false));
  }, [isRecording, isTranscribing, drafting, heard]);

  const busy = isTranscribing || drafting;
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;
  useEffect(() => onBusyRef.current?.(busy || isRecording), [busy, isRecording]);
  return (
    <section className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-theme-bg-tertiary p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{t('visit_talk_title', 'Talk the visit')}</h3>
        <button
          type="button"
          onClick={() => void toggleRecording()}
          disabled={busy}
          aria-pressed={isRecording}
          className={`inline-flex items-center gap-2 min-h-10 px-3 rounded-lg text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
            isRecording ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : isRecording ? (
            <Square className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Mic className="w-4 h-4" aria-hidden="true" />
          )}
          {isRecording ? (
            <>
              {t('visit_talk_stop', 'Stop and fill the report')}
              <span className="font-mono tabular-nums">{recordingDuration}s</span>
            </>
          ) : busy ? (
            t('visit_talk_drafting', 'Filling the report…')
          ) : (
            t('visit_talk_start', 'Start recording')
          )}
        </button>
      </div>
      <p className="text-xs text-slate-600 dark:text-theme-text-secondary">
        {t(
          'visit_talk_hint',
          'Say what you saw, what you did or advised, how long you stayed and when to come back. The report is filled in for you to check.'
        )}
      </p>
      {pendingCount > 0 && (
        <p className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300" role="status">
          <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
          {t('voice_waiting_for_signal', { defaultValue: '{count} waiting for signal', count: pendingCount })}
        </p>
      )}
    </section>
  );
};
