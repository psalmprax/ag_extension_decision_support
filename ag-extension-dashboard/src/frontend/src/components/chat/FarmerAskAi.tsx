import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Bot, Loader2 } from 'lucide-react';
import { askAiInThread, fetchTurnTakingSettings, sendThreadMessage } from '@/api/chatbotService';
import { officerReplyExpectation } from '@/lib/turnTakingText';

interface FarmerAskAiProps {
  /** The farmer's thread with their officer; created on first use. */
  ensureConversation: () => Promise<string>;
  /** What the farmer has typed but not sent; sent first, then answered. */
  input: string;
  clearInput: () => void;
  language: string;
  reload: (conversationId: string) => void;
}

function errorText(error: unknown): string {
  if (isAxiosError(error)) {
    const serverMessage = (error.response?.data as { error?: string } | undefined)?.error;
    if (error.response?.status === 429) return 'You have used your AI answers for now. Your officer will reply.';
    if (serverMessage) return serverMessage;
  }
  return 'The AI could not answer just now. Your officer will reply.';
}

/**
 * The farmer's Ask AI button in their thread: the AI answers their latest
 * message now, labelled as AI, and their officer can see it.
 */
export const FarmerAskAi: React.FC<FarmerAskAiProps> = ({ ensureConversation, input, clearInput, language, reload }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['chat-turn-taking'], queryFn: fetchTurnTakingSettings, staleTime: 10 * 60_000 });

  const ask = async () => {
    setBusy(true);
    setError(null);
    let conversationId: string | undefined;
    try {
      conversationId = await ensureConversation();
      const typed = input.trim();
      if (typed) {
        await sendThreadMessage(conversationId, typed, language);
        clearInput();
      }
      await askAiInThread(conversationId);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (conversationId) reload(conversationId);
    }
  };

  return (
    <div className="px-4 pt-2 flex items-center justify-between gap-3">
      <p className="text-xxs text-slate-500 dark:text-white/50" role="note">
        {error ? <span role="alert" className="text-rose-700 dark:text-rose-300">{error}</span> : data && officerReplyExpectation(data.settings)}
      </p>
      <button
        type="button"
        onClick={() => void ask()}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/40 disabled:opacity-50 shrink-0"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Bot className="w-3.5 h-3.5" aria-hidden="true" />}
        Ask AI
      </button>
    </div>
  );
};
