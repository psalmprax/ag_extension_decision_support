import React, { useId } from 'react';
import { CloudOff, Loader2, Mic, Square } from 'lucide-react';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { useLanguage } from '@/lib/LanguageContext';
import { voiceMessages } from '@/hooks/voiceMessages';

export interface DictationButtonProps {
  /** Called with each piece of text heard; the caller adds it to its field. */
  onTranscript: (text: string) => void;
  /** What the field is called, for screen readers ("Speak instead of typing: Findings"). */
  fieldLabel: string;
  /** Keeps recordings made with no signal for this field (see useFieldVoiceRecorder). */
  draftKey?: string;
  /** Record and transcribe on the server even where the browser could dictate. */
  preferServer?: boolean;
  /** Defaults to the app language. */
  language?: string;
  disabled?: boolean;
}

/** Speak instead of typing: tap to start, tap again to stop; the words go into the field to check. */
export const DictationButton: React.FC<DictationButtonProps> = ({
  onTranscript,
  fieldLabel,
  draftKey,
  preferServer,
  language,
  disabled,
}) => {
  const { t, language: appLanguage } = useLanguage();
  const { isRecording, isTranscribing, recordingDuration, pendingCount, toggleRecording } = useFieldVoiceRecorder({
    language: language ?? appLanguage,
    onTranscriptChunk: onTranscript,
    preferServer,
    draftKey,
    messages: voiceMessages(t),
  });
  // The mic's name never repeats the field's label, so the label names only its field
  // (for screen readers and for finding the field by its label); the field it fills is
  // given as the mic's description instead.
  const fieldId = useId();
  const label = isRecording ? t('chat_voice_stop', 'Stop recording') : t('voice_dictate', 'Speak instead of typing');
  const tooltip = isRecording
    ? label
    : t('voice_dictate_field', { defaultValue: 'Speak instead of typing: {field}', field: fieldLabel });

  return (
    <span className="inline-flex items-center gap-2">
      {pendingCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300" role="status">
          <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
          {t('voice_waiting_for_signal', { defaultValue: '{count} waiting for signal', count: pendingCount })}
        </span>
      )}
      <button
        type="button"
        onClick={() => void toggleRecording()}
        disabled={disabled || isTranscribing}
        aria-label={label}
        aria-describedby={fieldId}
        aria-pressed={isRecording}
        title={tooltip}
        className={`inline-flex items-center justify-center gap-1 h-10 min-w-10 rounded-lg border text-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
          isRecording
            ? 'px-2 border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
            : 'border-slate-200 dark:border-white/[0.08] text-slate-600 hover:text-slate-900 dark:text-theme-text-secondary dark:hover:text-theme-text-primary'
        }`}
      >
        {isTranscribing ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : isRecording ? (
          <>
            <Square className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-mono tabular-nums">{recordingDuration}s</span>
          </>
        ) : (
          <Mic className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
      <span id={fieldId} className="sr-only">{fieldLabel}</span>
    </span>
  );
};

interface DictationLabelProps extends Omit<DictationButtonProps, 'fieldLabel'> {
  htmlFor?: string;
  /** The field's label text, shown and used for the mic's name. */
  children: string;
  className?: string;
  /** Spacing for the row holding the label and the mic. */
  rowClassName?: string;
}

/** A field label with a mic at its end, so any text box can be filled by speaking. */
export const DictationLabel: React.FC<DictationLabelProps> = ({ htmlFor, children, className, rowClassName = '', ...button }) => (
  <div className={`flex items-end justify-between gap-2 ${rowClassName}`}>
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
    <DictationButton fieldLabel={children} {...button} />
  </div>
);
