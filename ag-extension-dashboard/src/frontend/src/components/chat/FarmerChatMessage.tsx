import React from 'react';
import { ChatMarkdown } from './ChatMarkdown';
import { Bot, ShieldCheck, Sprout } from 'lucide-react';
import type { ChatMessage } from '@/types/dashboard';
import { AudioReaderButton } from '@/components/audio/AudioReaderButton';
import { formatChatTime } from '@/lib/chatTime';
import { farmerChatSender, type FarmerChatSender } from '@/lib/farmerChatSender';

const CHANNEL_LABEL = { sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram' } as const;

const SENDER_ICON: Record<FarmerChatSender, React.ComponentType<{ className?: string }>> = {
  farmer: Sprout,
  assistant: Bot,
  officer: ShieldCheck,
};

/** One message in the farmer chat thread, labelled and styled by sender. */
export const FarmerChatMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const look = farmerChatSender(message.role);
  const Icon = SENDER_ICON[look.sender];
  // Backend sends `createdAt`; never render "Invalid Date" for bad values.
  const timeLabel = formatChatTime(message);
  const onDark = look.sender === 'officer';

  return (
    <div className={`flex ${look.align === 'end' ? 'justify-end' : 'justify-start'}`} data-sender={look.sender}>
      <div
        role="group"
        aria-label={`${look.label} message`}
        className={`max-w-[75%] p-4 rounded-xl shadow-sm space-y-1.5 ${look.bubbleClass}`}
      >
        <div className={`flex items-center gap-1.5 text-xs font-medium ${onDark ? 'text-white/90' : ''}`}>
          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{look.label}</span>
          {message.channel && (
            <span className="ml-1 font-normal opacity-75">
              {look.sender === 'farmer' ? 'via' : 'sent by'} {CHANNEL_LABEL[message.channel]}
            </span>
          )}
        </div>
        {/* AI answers are markdown; what farmers and officers type stays verbatim. */}
        {look.sender === 'assistant' ? (
          <div className="text-xs sm:text-sm"><ChatMarkdown content={message.content} /></div>
        ) : (
          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
        )}
        <div className={`flex items-center justify-between gap-3 text-xxs font-mono pt-1 border-t ${look.metaClass}`}>
          <AudioReaderButton
            text={message.content}
            size="xs"
            variant="ghost"
            className={onDark ? 'text-white/70 hover:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white'}
          />
          {timeLabel && <span>{timeLabel}</span>}
        </div>
      </div>
    </div>
  );
};
