import React from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { useLanguage } from '@/lib/LanguageContext';

interface ChatVoiceButtonProps {
  language: string;
  /** Called with the transcript; it goes into the message box to check before sending. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/** Speak instead of typing: tap to record, tap again to stop; the words appear in the message box. */
export const ChatVoiceButton: React.FC<ChatVoiceButtonProps> = ({ language, onTranscript, disabled }) => {
  const { t } = useLanguage();
  const { isRecording, isTranscribing, recordingDuration, toggleRecording } = useFieldVoiceRecorder({
    language,
    onTranscriptChunk: onTranscript,
    preferServer: true,
  });
  const label = isRecording
    ? t('chat_voice_stop', 'Stop recording')
    : t('chat_voice_record', 'Record a voice message');

  return (
    <button
      type="button"
      onClick={() => void toggleRecording()}
      disabled={disabled || isTranscribing}
      aria-label={label}
      aria-pressed={isRecording}
      title={label}
      className={`flex items-center justify-center gap-1 h-10 rounded-lg border text-xs disabled:opacity-50 ${
        isRecording
          ? 'px-2 border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          : 'w-10 border-slate-200 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white'
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
  );
};
