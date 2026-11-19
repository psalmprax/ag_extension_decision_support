import { useUnreadChats } from '@/hooks/useUnreadChats';

/** A count of unread messages: for one conversation, or (no id) all of them. */
export function UnreadCount({ conversationId, className = '' }: { conversationId?: string; className?: string }) {
  const unread = useUnreadChats();
  const count = conversationId ? unread.conversations[conversationId] ?? 0 : unread.total;
  if (count <= 0) return null;
  return (
    <span
      className={`min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-medium tabular-nums flex items-center justify-center shrink-0 ${className}`}
      aria-label={`${count} unread ${count === 1 ? 'message' : 'messages'}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
