import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, UserCheck } from 'lucide-react';
import { createConversation, sendThreadMessage } from '@/api/chatbotService';
import { FarmerAskAi } from '@/components/chat/FarmerAskAi';
import { ChatPhotoButton, type PhotoTarget } from '@/components/chat/ChatPhotoButton';
import { ChatVoiceButton } from '@/components/chat/ChatVoiceButton';
import { FarmerChatMessage } from '@/components/chat/FarmerChatMessage';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import type { ThreadPageProps } from '@/components/chat/threadProps';
import { useQuery } from '@tanstack/react-query';
import { fetchFarmerStats } from '@/api/farmerService';
import { EarlierMessagesButton } from '@/components/chat/EarlierMessagesButton';

/**
 * The farmer's chat with their extension officer, the in-app counterpart of
 * SMS, WhatsApp and Telegram: their own thread only, Ask AI for an answer
 * now, and no officer tools (no farmer list, copilot or field data).
 */
export const FarmerOfficerChatPage: React.FC<ThreadPageProps> = ({
  farmerConversations,
  activeFarmerConvId,
  setActiveFarmerConvId,
  loadFarmerMessages,
  farmerChatMessages,
  farmerHistory,
  farmerChatInput,
  setFarmerChatInput,
  handleFarmerChatSend,
}) => {
  const { t } = useLanguage();
  const { language } = useLanguage();
  const myId = useAppStore(state => state.user?.id);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Shared with the farmer dashboard's query, so it is usually already loaded.
  const { data: stats } = useQuery({ queryKey: ['farmer-stats'], queryFn: fetchFarmerStats });
  const assignedOfficer = stats?.data?.officerName ?? null;
  const thread = farmerConversations.find(c => c.id === activeFarmerConvId) ?? farmerConversations[0] ?? null;
  const threadId = thread?.id ?? activeFarmerConvId;

  useEffect(() => {
    if (threadId && threadId !== activeFarmerConvId) {
      setActiveFarmerConvId(threadId);
    }
    if (threadId) void loadFarmerMessages(threadId);
  }, [threadId, activeFarmerConvId, setActiveFarmerConvId, loadFarmerMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [farmerChatMessages.length]);

  const realtime = useConversationRealtime({
    conversationId: threadId,
    enabled: true,
    onNewMessage: loadFarmerMessages,
  });

  /** The thread with their assigned officer, created with their first message. */
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (threadId) return threadId;
    const res = await createConversation({ kind: 'farmer_thread', language });
    if (!res?.success || !res.data?.id) throw new Error('Could not start a conversation with your officer');
    setActiveFarmerConvId(res.data.id);
    return res.data.id as string;
  }, [threadId, language, setActiveFarmerConvId]);

  /** The thread and the farmer's own record, starting the thread if this is the first message. */
  const resolvePhotoTarget = useCallback(async (): Promise<PhotoTarget> => {
    if (thread?.id && thread.farmerId) return { conversationId: thread.id, farmerId: thread.farmerId };
    const res = await createConversation({ kind: 'farmer_thread', language });
    if (!res?.success || !res.data?.id || !res.data?.farmerId) {
      throw new Error('Could not start a conversation with your officer');
    }
    setActiveFarmerConvId(res.data.id);
    return { conversationId: res.data.id as string, farmerId: res.data.farmerId as string };
  }, [thread, language, setActiveFarmerConvId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = farmerChatInput.trim();
    if (!text) return;
    setError(null);
    if (threadId) {
      await handleFarmerChatSend();
      return;
    }
    // First message: start the thread, then send.
    setSending(true);
    try {
      const id = await ensureConversation();
      await sendThreadMessage(id, text, language);
      setFarmerChatInput('');
      await loadFarmerMessages(id);
    } catch (err) {
      console.error('First message to the officer failed:', err);
      setError('Your message could not be sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const officerTyping = realtime.typingUser && realtime.typingUser !== myId;

  return (
    <div className="flex flex-col h-[calc(100dvh-150px)] md:h-[calc(100vh-140px)] gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">{t('ui_farmer_officer_chat_page_my_extension_officer')}</h2>
          <p className="text-sm text-slate-500 dark:text-white/60 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            {thread?.officerName ||
              assignedOfficer ||
              t('farmer_chat_no_officer', { defaultValue: 'No officer is assigned to you yet. Your message will reach the next one assigned.' })}
          </p>
        </div>
        <span role="status" className="flex items-center gap-1.5 text-xxs text-slate-500 dark:text-white/50 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${realtime.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
          {realtime.connected ? 'Live updates' : 'Updates paused'}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-theme-bg-secondary/60 border border-slate-200 dark:border-white/10 rounded-xl">
        <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
          {farmerChatMessages.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-white/50 text-center py-12">
              {t('ui_farmer_officer_chat_page_ask_your_officer_anything_about_your')}
            </p>
          ) : (
            <>
              <EarlierMessagesButton history={farmerHistory} />
              {farmerChatMessages.map((message, index) => (
                <FarmerChatMessage key={message.id ?? `${message.timestamp ?? ''}-${index}`} message={message} viewer="farmer" />
              ))}
            </>
          )}
          {officerTyping && <p className="text-xxs text-slate-500 dark:text-white/50">{t('ui_farmer_officer_chat_page_your_officer_is_typing')}</p>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-200 dark:border-white/10">
          <FarmerAskAi
            ensureConversation={ensureConversation}
            input={farmerChatInput}
            clearInput={() => setFarmerChatInput('')}
            language={language}
            reload={id => void loadFarmerMessages(id)}
          />
          <form onSubmit={e => void send(e)} className="flex items-center gap-2 p-3">
            <ChatPhotoButton
              resolveTarget={resolvePhotoTarget}
              caption={farmerChatInput}
              clearCaption={() => setFarmerChatInput('')}
              language={language}
              onSent={id => loadFarmerMessages(id)}
              disabled={sending}
            />
            <ChatVoiceButton
              language={language}
              disabled={sending}
              onTranscript={text => setFarmerChatInput(farmerChatInput.trim() ? `${farmerChatInput.trim()} ${text}` : text)}
            />
            <label htmlFor="farmer-officer-message" className="sr-only">
              {t('ui_farmer_officer_chat_page_message_to_your_officer')}
            </label>
            <input
              id="farmer-officer-message"
              value={farmerChatInput}
              disabled={sending}
              onChange={e => {
                setFarmerChatInput(e.target.value);
                realtime.notifyTyping();
              }}
              placeholder="Write to your officer…"
              className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-theme-bg-primary px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={sending || !farmerChatInput.trim()}
              aria-label="Send message"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
            </button>
          </form>
          {error && (
            <p role="alert" className="px-3 pb-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarmerOfficerChatPage;
