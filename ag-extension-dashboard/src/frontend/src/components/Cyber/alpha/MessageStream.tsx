import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatMessageItem } from './response';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';

export interface MessageStreamProps {
  messages: ChatMessageItem[];
  isProcessing: boolean;
  activeReasoningStep: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  /** Shown above each of the person's own messages. */
  youLabel: string;
  assistantLabel: string;
}

/** The conversation with the AI agronomist, newest at the bottom, with what it is doing now. */
export const MessageStream: React.FC<MessageStreamProps> = ({ messages, isProcessing, activeReasoningStep, messagesEndRef, youLabel, assistantLabel }) => (
  <div className="overflow-y-auto space-y-4 pr-1 flex-1 mb-4" aria-live="polite">
    {messages.map(msg => (
      <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-500 dark:text-white/50">
          <span>{msg.sender === 'user' ? youLabel : assistantLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{msg.timestamp}</span>
        </div>
        <div
          className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            msg.sender === 'user'
              ? 'bg-emerald-700 text-white rounded-tr-md'
              : 'bg-slate-50 border border-slate-900/[0.08] text-slate-800 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white/90 rounded-tl-md'
          }`}
        >
          <div data-message>{msg.sender === 'user' ? <div className="whitespace-pre-line">{msg.text}</div> : <ChatMarkdown content={msg.text} />}</div>
        </div>
      </div>
    ))}
    {isProcessing && activeReasoningStep && (
      <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/60">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {activeReasoningStep}
      </p>
    )}
    <div ref={messagesEndRef} />
  </div>
);
