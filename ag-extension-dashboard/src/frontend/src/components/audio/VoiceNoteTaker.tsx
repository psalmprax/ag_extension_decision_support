import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Check, FileText, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { voiceMessages } from '@/hooks/voiceMessages';
import { useAppStore } from '@/store/useAppStore';
import { AudioReaderButton } from './AudioReaderButton';
import { useLanguage } from '@/lib/LanguageContext';
import { appLanguage } from '@/lib/appLocale';

export interface VoiceNoteTakerProps {
  /** Callback fired when transcription is ready or saved */
  onSaveNote?: (transcript: string) => void;
  /** Optional placeholder or instruction */
  placeholder?: string;
  /** Initial language override */
  initialLanguage?: string;
  /** Compact mode for embedding inside form cards */
  compact?: boolean;
  className?: string;
}

const SUPPORTED_VOICE_LANGUAGES = [
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
  { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
  { code: 'ny', name: 'Chichewa', flag: '🇲🇼' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'am', name: 'Amharic', flag: '🇪🇹' },
];

/** The app language when dictation supports it, otherwise English. */
function dictationLanguage(appCode: string): string {
  return SUPPORTED_VOICE_LANGUAGES.some(l => l.code === appCode) ? appCode : 'en';
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * VoiceNoteTaker — An accessible, multilingual audio note taker for low-literacy farmers
 * and hands-free extension workers. Enables speaking observations and symptoms in vernacular.
 */
export const VoiceNoteTaker: React.FC<VoiceNoteTakerProps> = ({
  onSaveNote,
  placeholder = 'Speak your field observation, crop disease symptoms, or questions...',
  initialLanguage,
  compact = false,
  className = '',
}) => {
  const { t } = useLanguage();
  const storeLanguage = useAppStore(s => s.preferredAudioLanguage);
  const setStoreLanguage = useAppStore(s => s.setPreferredAudioLanguage);

  // Until a language is picked here, dictation listens in the app's language (Kiswahili made English notes garbled).
  const [currentLang, setCurrentLang] = useState(() => initialLanguage || storeLanguage || dictationLanguage(appLanguage()));
  const [transcript, setTranscript] = useState('');
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    interimText,
    toggleRecording,
  } = useFieldVoiceRecorder({
    language: currentLang,
    messages: voiceMessages(t),
    onTranscriptChunk: chunk => {
      setTranscript(prev => (prev ? `${prev} ${chunk}` : chunk));
    },
  });

  const activeLangObj =
    SUPPORTED_VOICE_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_VOICE_LANGUAGES[0];

  const handleLanguageChange = (code: string) => {
    setCurrentLang(code);
    setStoreLanguage(code);
    setIsLanguageMenuOpen(false);
    toast.success(`Voice language set to ${SUPPORTED_VOICE_LANGUAGES.find(l => l.code === code)?.name}`);
  };

  const handleClear = () => {
    setTranscript('');
    toast.success('Voice memo cleared');
  };

  const handleSave = () => {
    if (!transcript.trim()) {
      toast.error('No voice note to save. Speak first.');
      return;
    }
    onSaveNote?.(transcript.trim());
    toast.success('Voice note captured successfully!');
  };

  // Close language menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      role="region"
      aria-label="Voice Note Taker"
      className={`rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-theme-bg-secondary/95 shadow-sm p-4 transition-all ${className}`}
    >
      {/* Header with Language Selector & Status */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-medium">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-slate-900 dark:text-white leading-none">
              {t('ui_voice_note_taker_audio_note_taker')}
            </h4>
            <p className="text-3xs text-slate-500 dark:text-theme-text-muted mt-0.5">
              {t('ui_voice_note_taker_speak_in_your_language_for_automatic')}
            </p>
          </div>
        </div>

        {/* Language selector dropdown */}
        <div className="relative" ref={languageMenuRef}>
          <button
            type="button"
            onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-theme-bg-tertiary/80 text-xs font-medium text-slate-700 dark:text-theme-text-primary hover:border-emerald-500/50 transition-colors"
            aria-label={`Current language: ${activeLangObj.name}. Click to change.`}
          >
            <span className="text-xxs">{activeLangObj.name}</span>
            <Languages className="w-3 h-3 text-slate-400" />
          </button>

          <AnimatePresence>
            {isLanguageMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute end-0 mt-1 w-44 rounded-xl bg-white dark:bg-theme-bg-tertiary border border-slate-200 dark:border-white/[0.12] shadow-xl z-50 py-1 max-h-56 overflow-y-auto"
              >
                <div className="px-2.5 py-1 text-xs font-medium text-slate-400">
                  {t('ui_voice_note_taker_select_spoken_language')}
                </div>
                {SUPPORTED_VOICE_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full text-start px-3 py-1.5 text-xs flex items-center justify-between hover:bg-emerald-500/10 dark:hover:bg-white/[0.08] transition-colors ${
                      lang.code === currentLang ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-theme-text-primary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.name}</span>
                    </span>
                    {lang.code === currentLang && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Recording Console */}
      <div className="my-4 flex flex-col items-center justify-center text-center">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={isTranscribing}
          aria-label={isRecording ? 'Stop recording voice note' : 'Start speaking voice note'}
          className={`relative group rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
            compact ? 'w-14 h-14' : 'w-20 h-20'
          } ${
            isRecording
              ? 'bg-rose-600 text-white ring-4 ring-rose-500/20'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/10 shadow-sm'
          }`}
        >
          {isRecording ? (
            <Square className={compact ? 'w-5 h-5 fill-white' : 'w-7 h-7 fill-white'} />
          ) : (
            <Mic className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
          )}

          {isRecording && (
            <span className="absolute -bottom-1 text-3xs font-medium bg-slate-900/90 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
              {formatTime(recordingDuration)}
            </span>
          )}
        </button>

        <p className="mt-3 text-xs font-medium text-slate-800 dark:text-theme-text-primary">
          {isRecording
            ? `Listening in ${activeLangObj.name}...`
            : isTranscribing
            ? 'Transcribing speech with AI...'
            : `Tap mic to speak in ${activeLangObj.name}`}
        </p>
        <p className="text-3xs text-slate-500 dark:text-theme-text-muted mt-0.5 max-w-xs">
          {isRecording
            ? 'Speak clearly into your microphone; tap again when finished.'
            : placeholder}
        </p>

        {/* Interim live speech stream */}
        {interimText && isRecording && (
          <div className="mt-2.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 italic max-w-md w-full animate-fade-in">
            "{interimText}..."
          </div>
        )}
      </div>

      {/* Captured Transcript Box & Actions */}
      {transcript ? (
        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-theme-bg-tertiary/60 border border-slate-200 dark:border-white/[0.12] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <FileText className="w-3.5 h-3.5" />
              <span>{t('ui_voice_note_taker_transcribed_note', { name: activeLangObj.name })}</span>
            </div>

            {/* Read aloud the transcribed note */}
            <div className="flex items-center gap-1">
              <AudioReaderButton
                text={transcript}
                language={currentLang}
                size="xs"
                variant="subtle"
                label="Listen"
              />
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="Clear transcript"
                aria-label="Clear transcript"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-800 dark:text-theme-text-primary leading-relaxed font-sans bg-white dark:bg-theme-bg-secondary p-2.5 rounded-lg border border-slate-100 dark:border-white/[0.08] select-text">
            {transcript}
          </p>

          {onSaveNote && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('ui_voice_note_taker_save_voice_note')}</span>
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
