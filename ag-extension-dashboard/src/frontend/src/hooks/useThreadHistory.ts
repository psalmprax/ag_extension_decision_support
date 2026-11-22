import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { fetchMessages } from '@/api/chatbotService';
import type { ChatMessage } from '@/types/dashboard';

/**
 * Older pages of a farmer thread. The server sends the latest messages first; this loads
 * the page before the oldest one shown, for as long as the server says there are more.
 */
export function useThreadHistory(
  activeIdRef: MutableRefObject<string | null>,
  messages: ChatMessage[],
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  const [hasEarlier, setHasEarlier] = useState(false);
  const loadingRef = useRef(false);

  const loadEarlier = useCallback(async () => {
    const conversationId = activeIdRef.current;
    const oldest = messages.find(message => message.id)?.id;
    if (!conversationId || !oldest || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await fetchMessages(conversationId, oldest);
      // The person may have opened another thread meanwhile.
      if (activeIdRef.current !== conversationId) return;
      const older = (res.data || []) as ChatMessage[];
      setMessages(current => [...older, ...current]);
      setHasEarlier(Boolean(res.hasMore));
    } catch (error) {
      console.error('Failed to load earlier messages:', error);
      toast.error('Could not load earlier messages.');
    } finally {
      loadingRef.current = false;
    }
  }, [activeIdRef, messages, setMessages]);

  return { hasEarlier, setHasEarlier, loadEarlier };
}
