import { useQuery } from '@tanstack/react-query';
import { fetchUnreadSummary, type UnreadSummary } from '@/api/chatbotService';
import { useAppStore } from '@/store/useAppStore';
import { lacksPaidAccess } from '@/lib/planAccess';
import { queryClient } from '@/lib/queryClient';

export const UNREAD_CHATS_KEY = ['chat-unread'] as const;

const NONE: UnreadSummary = { total: 0, conversations: {} };

/**
 * Unread farmer-thread messages for the signed-in officer or farmer, refreshed
 * every 30 seconds. Nothing for other roles, the Free plan (no chat) or the demo.
 */
export function useUnreadChats(): UnreadSummary {
  const user = useAppStore(state => state.user);
  const enabled = Boolean(user && !user.isDemo && !lacksPaidAccess(user, 'chat')
    && (user.role === 'extension_officer' || user.role === 'farmer'));
  const { data } = useQuery({
    queryKey: UNREAD_CHATS_KEY,
    queryFn: fetchUnreadSummary,
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
    // The app's shared client, so the badge works wherever the menu is rendered.
  }, queryClient);
  return enabled && data ? data : NONE;
}
