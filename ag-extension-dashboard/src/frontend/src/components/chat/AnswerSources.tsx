import React from 'react';
import { BookOpen, PenLine, AlertTriangle } from 'lucide-react';
import type { AnswerSource, ChatMessageMetadata } from '@/types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';

/** The sources an AI answer or draft rests on, numbered as in its [n] markers. */
export const SourceList: React.FC<{ sources: AnswerSource[]; className?: string }> = ({ sources, className = '' }) => {
  const { t } = useLanguage();
  if (!sources.length) return null;
  return (
    <div className={`text-xxs space-y-0.5 ${className}`}>
      <p className="flex items-center gap-1 font-medium">
        <BookOpen className="w-3 h-3" aria-hidden="true" />
        {t('chat_sources_title', 'Sources')}
      </p>
      <ol aria-label={t('chat_sources_title', 'Sources')} className="space-y-0.5">
        {sources.map(source => (
          <li key={source.n} className="flex gap-1">
            <span className="font-mono">[{source.n}]</span>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-words">
                {source.title}
              </a>
            ) : (
              <span className="break-words">{source.title}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

/** "Not from a verified source": shown with general guidance so nobody mistakes it for sourced advice. */
export const UnverifiedNote: React.FC<{ viewer: 'officer' | 'farmer'; reviewQueued?: boolean }> = ({ viewer, reviewQueued }) => {
  const { t } = useLanguage();
  const text = viewer === 'farmer'
    ? t('chat_unverified_farmer', 'Not from a verified source. Check with your officer before you act on it.')
    : reviewQueued
      ? t('chat_unverified_officer_review', 'Not from a verified source. Queued for agronomist review.')
      : t('chat_unverified_officer', 'Not from a verified source. Check it before passing it on.');
  return (
    <p role="note" className="flex items-start gap-1 text-xxs text-amber-800 dark:text-amber-300">
      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
};

/** What a message rests on: an AI answer's sources, or that an officer's reply began as an AI draft. */
export const MessageProvenance: React.FC<{ metadata?: ChatMessageMetadata | null; sender: string; viewer: 'officer' | 'farmer' }> = ({
  metadata,
  sender,
  viewer,
}) => {
  const { t } = useLanguage();
  if (!metadata) return null;
  if (sender === 'assistant') {
    return (
      <div className="space-y-1 pt-1">
        <SourceList sources={metadata.sources ?? []} />
        {metadata.evidence === 'general' && <UnverifiedNote viewer={viewer} reviewQueued={Boolean(metadata.review)} />}
      </div>
    );
  }
  if (sender === 'officer' && metadata.aiDraft) {
    const text = viewer === 'farmer'
      ? t('chat_ai_draft_checked', 'Drafted with AI and checked by your officer')
      : metadata.aiDraft.edited
        ? t('chat_ai_draft_edited', 'From an AI draft, edited before sending')
        : t('chat_ai_draft_as_is', 'From an AI draft, sent as drafted');
    return (
      <p className="flex items-center gap-1 text-xxs opacity-80">
        <PenLine className="w-3 h-3" aria-hidden="true" />
        {text}
      </p>
    );
  }
  return null;
};
