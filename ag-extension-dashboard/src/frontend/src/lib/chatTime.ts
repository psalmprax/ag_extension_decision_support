/**
 * Chat message timestamps. Backend ChatMessageDTO carries `createdAt` while
 * some producers send `timestamp`; either may be missing or unparseable.
 * Returns '' instead of "Invalid Date" so the UI stays clean.
 */
export function formatChatTime(msg: { timestamp?: string; createdAt?: string | null }): string {
  const raw = msg.timestamp ?? msg.createdAt ?? null;
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
