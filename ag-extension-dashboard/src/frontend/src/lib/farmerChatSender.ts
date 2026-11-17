import type { ChatMessage } from '@/types/dashboard';

export type FarmerChatSender = 'farmer' | 'assistant' | 'officer';

export interface SenderPresentation {
  sender: FarmerChatSender;
  /** Visible, sentence-case label shown at the top of the bubble. */
  label: string;
  /** Which side of the thread the bubble sits on. */
  align: 'start' | 'end';
  bubbleClass: string;
  metaClass: string;
}

/**
 * Farmer, AI and officer messages each get their own label, surface and side,
 * so an AI reply can never be mistaken for something the farmer wrote.
 */
export function farmerChatSender(role: ChatMessage['role']): SenderPresentation {
  if (role === 'officer') {
    return {
      sender: 'officer',
      label: 'Officer',
      align: 'end',
      bubbleClass: 'bg-emerald-600 text-white rounded-tr-none border border-emerald-500/20',
      metaClass: 'text-white/75 border-white/20',
    };
  }
  if (role === 'assistant') {
    return {
      sender: 'assistant',
      label: 'AI advisory',
      align: 'start',
      bubbleClass:
        'ml-6 bg-sky-50 dark:bg-sky-950/40 text-slate-800 dark:text-white/90 rounded-tl-none border border-sky-200 dark:border-sky-400/20 border-l-2 border-l-sky-500',
      metaClass: 'text-sky-800/80 dark:text-sky-200/70 border-sky-200/80 dark:border-sky-400/15',
    };
  }
  return {
    sender: 'farmer',
    label: 'Farmer',
    align: 'start',
    bubbleClass:
      'bg-white dark:bg-slate-900 text-slate-800 dark:text-white/90 rounded-tl-none border border-slate-200 dark:border-white/[0.08]',
    metaClass: 'text-slate-600 dark:text-white/50 border-slate-200/80 dark:border-white/[0.08]',
  };
}

/** The farmer's latest message in a thread ('user' and 'farmer' are both the farmer). */
export function lastFarmerMessage(messages: ReadonlyArray<Pick<ChatMessage, 'role' | 'content'>>): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (farmerChatSender(messages[i].role).sender === 'farmer') return messages[i].content;
  }
  return null;
}
