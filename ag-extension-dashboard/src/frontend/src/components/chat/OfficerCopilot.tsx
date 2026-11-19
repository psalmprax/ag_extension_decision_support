import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, PenLine, X } from 'lucide-react';
import { getChatCompletion, getCopilotDraft } from '@/api/aiService';
import type { ChatMessage } from '@/types/dashboard';
import { lastFarmerMessage } from '@/lib/farmerChatSender';
import {
  defaultFollowUpQuestions,
  parseFollowUpQuestions,
} from '@/pages/farmerChatSafety';
import { useLanguage } from '@/lib/LanguageContext';
import { rememberCopilotDraft } from '@/lib/copilotDraft';
import type { CopilotDraft } from '@/api/aiService';
import { SourceList, UnverifiedNote } from './AnswerSources';

const DRAFT_INSTRUCTION =
  "Draft a short, clear reply from the extension officer to the farmer's latest message in this conversation. " +
  'Ask for missing details rather than guessing, and do not give product rates or doses.';

type DraftState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'ready' } & CopilotDraft)
  | { status: 'error' };

interface OfficerCopilotProps {
  conversationId: string;
  messages: ChatMessage[];
  language: string;
  /** Put text into the officer's message box. Nothing is sent until they press Send. */
  onUseText: (text: string) => void;
}

/**
 * The officer's copilot for a farmer thread. Everything here is private to the
 * officer: suggested follow-up questions and an AI draft reply, both of which
 * only fill the message box. The farmer sees nothing until the officer sends.
 */
export const OfficerCopilot: React.FC<OfficerCopilotProps> = ({ conversationId, messages, language, onUseText }) => {
  const { t } = useLanguage();
  const farmerSaid = useMemo(() => lastFarmerMessage(messages), [messages]);
  const [suggestions, setSuggestions] = useState<{ key: string; lines: string[] } | null>(null);
  const [draft, setDraft] = useState<DraftState>({ status: 'idle' });
  const suggestionKey = `${conversationId}:${farmerSaid ?? ''}`;

  // A new thread starts with no draft.
  useEffect(() => setDraft({ status: 'idle' }), [conversationId]);

  useEffect(() => {
    if (!farmerSaid) return;
    let cancelled = false;
    getChatCompletion(
      `Given farmer said: "${farmerSaid.slice(0, 300)}", suggest 3 short information-gathering questions (<=15 words each), one per line. Do not prescribe treatments or assume field conditions.`,
      undefined,
      'en'
    )
      .then(res => {
        const text = res.data.messages.find(message => message.role === 'assistant')?.content ?? '';
        const lines = parseFollowUpQuestions(text);
        if (!cancelled && lines.length >= 2) setSuggestions({ key: suggestionKey, lines });
      })
      .catch(err => {
        console.error('AI copilot suggestions fetch failed — keeping static suggestions:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [farmerSaid, suggestionKey]);

  const live = suggestions?.key === suggestionKey ? suggestions.lines : null;
  // The fallback list is a static reference: never present it as AI output.
  const chips = live ?? defaultFollowUpQuestions;

  const requestDraft = async () => {
    setDraft({ status: 'loading' });
    try {
      const result = await getCopilotDraft(conversationId, DRAFT_INSTRUCTION, language);
      setDraft(result.text.trim() ? { status: 'ready', ...result, text: result.text.trim() } : { status: 'error' });
    } catch (error) {
      console.error('Copilot draft failed:', error);
      setDraft({ status: 'error' });
    }
  };

  return (
    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200/80 dark:border-white/[0.04] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xxs font-mono text-emerald-700 dark:text-emerald-400">
          <Bot className="w-3 h-3" aria-hidden="true" />
          <span>
            {live
              ? 'AI-generated follow-up questions (review before sending):'
              : 'Suggested follow-ups (reference only, not AI-generated):'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void requestDraft()}
          disabled={draft.status === 'loading'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xxs font-medium bg-white dark:bg-slate-900 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50 shrink-0"
        >
          {draft.status === 'loading' ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <PenLine className="w-3 h-3" aria-hidden="true" />
          )}
          {t('ui_officer_copilot_copilot_draft_a_reply')}
        </button>
      </div>

      {draft.status === 'ready' && (
        <div
          role="region"
          aria-label="AI draft reply"
          className="rounded-lg border border-sky-200 dark:border-sky-400/20 bg-sky-50 dark:bg-sky-950/40 p-3 space-y-2"
        >
          <p className="text-xxs font-medium text-sky-800 dark:text-sky-200">
            {t('ui_officer_copilot_ai_draft_only_you_can_see_this_check')}
          </p>
          <p className="text-xs text-slate-800 dark:text-white/90 whitespace-pre-line">{draft.text}</p>
          <SourceList sources={draft.sources} className="text-slate-700 dark:text-white/70" />
          {draft.evidence === 'general' && <UnverifiedNote viewer="officer" />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onUseText(draft.text);
                rememberCopilotDraft(conversationId, draft.text);
                setDraft({ status: 'idle' });
              }}
              className="px-2.5 py-1 rounded-lg text-xxs font-medium bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {t('ui_officer_copilot_use_draft')}
            </button>
            <button
              type="button"
              onClick={() => setDraft({ status: 'idle' })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xxs text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              {t('ui_officer_copilot_discard')}
            </button>
          </div>
        </div>
      )}
      {draft.status === 'error' && (
        <p role="alert" className="text-xxs text-rose-700 dark:text-rose-300">
          {t('ui_officer_copilot_the_copilot_could_not_draft_a_reply')}
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onUseText(suggestion)}
            className="px-2.5 py-1 rounded-lg text-xxs font-sans bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white shrink-0 transition-colors text-left max-w-xs truncate"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
