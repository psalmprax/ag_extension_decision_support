import React, { useState } from 'react';
import { Mic, Send, Volume2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ChatPhotoButton, type PhotoTarget } from './ChatPhotoButton';
import type { ReplySendOptions } from './threadProps';

interface OfficerChatComposerProps {
  value: string;
  onType: (value: string) => void;
  clear: () => void;
  onSubmit: (e: React.FormEvent, options: ReplySendOptions) => void;
  voiceOpen: boolean;
  toggleVoice: () => void;
  /** The open conversation and its farmer; photos are disabled without a farmer. */
  photoTarget: PhotoTarget | null;
  onPhotoSent: (conversationId: string) => void | Promise<void>;
}

/** The officer's message box in Farmer Chat: dictate, type, attach photos, send. */
export const OfficerChatComposer: React.FC<OfficerChatComposerProps> = ({
  value,
  onType,
  clear,
  onSubmit,
  voiceOpen,
  toggleVoice,
  photoTarget,
  onPhotoSent,
}) => {
  const { t, language } = useLanguage();
  const { btnClass } = useThemeClasses();
  // Kept on until turned off, for officers whose farmers listen rather than read.
  const [speak, setSpeak] = useState(false);
  const messageLabel = t('ui_officer_chat_message_label', 'Message to the farmer');
  const dictateTooltip = t('voice_dictate_field', { defaultValue: 'Speak instead of typing: {field}', field: messageLabel });

  return (
    <form
      onSubmit={e => onSubmit(e, { speak })}
      className="p-4 bg-slate-50/80 dark:bg-theme-bg-primary/80 border-t border-slate-200/80 dark:border-white/[0.08]"
    >
      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={toggleVoice}
          className={`p-3 rounded-xl border transition-all ${
            voiceOpen
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'
              : 'bg-white dark:bg-theme-bg-secondary text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/[0.1] hover:border-slate-300 dark:hover:border-white/20'
          }`}
          title={dictateTooltip}
          aria-label={t('voice_dictate', 'Speak instead of typing')}
          aria-pressed={voiceOpen}
        >
          <Mic className="w-4 h-4" />
        </button>
        <ChatPhotoButton
          resolveTarget={async () => {
            if (!photoTarget) throw new Error('Open a farmer conversation first');
            return photoTarget;
          }}
          caption={value}
          clearCaption={clear}
          language={language}
          onSent={onPhotoSent}
          disabled={!photoTarget}
        />
        <input
          type="text"
          value={value}
          onChange={e => onType(e.target.value)}
          aria-label={messageLabel}
          placeholder={t('farmer_chat_placeholder') || 'Type agronomic guidance or broadcast prompt...'}
          className="flex-1 bg-white dark:bg-theme-bg-secondary border border-slate-200 dark:border-white/[0.1] rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none transition-all"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!value.trim()}
          className={`p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors disabled:opacity-40 ${btnClass}`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setSpeak(on => !on)}
        aria-pressed={speak}
        className={`mt-2 inline-flex items-center gap-2 min-h-9 px-2 rounded-lg text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
          speak
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
            : 'text-slate-600 hover:text-slate-900 dark:text-theme-text-secondary dark:hover:text-theme-text-primary'
        }`}
      >
        <Volume2 className="w-4 h-4" aria-hidden="true" />
        {speak
          ? t('chat_speak_reply_on', 'Your reply is also sent as a voice message on WhatsApp')
          : t('chat_speak_reply_off', 'Also send as a voice message (WhatsApp)')}
      </button>
    </form>
  );
};
