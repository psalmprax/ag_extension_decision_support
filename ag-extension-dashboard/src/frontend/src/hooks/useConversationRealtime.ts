import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { safeStorage } from '@/lib/safeStorage';

interface ConversationRealtimeOptions {
  /** The conversation to join; null while none is open. */
  conversationId: string | null;
  /** False in demo mode, which has no live server. */
  enabled: boolean;
  /** A new message arrived in the open conversation. */
  onNewMessage: (conversationId: string) => void;
}

/**
 * Live updates for an open chat thread: joins the conversation's room (the
 * server checks access), reloads on new messages from the other side (an
 * officer, the farmer or the AI), and shares typing indicators.
 */
export function useConversationRealtime({ conversationId, enabled, onNewMessage }: ConversationRealtimeOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Cookie auth: the browser attaches the httpOnly ag_token cookie on the
      // websocket upgrade automatically — no token in the auth payload.
      auth: cb => cb({}),
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('user_typing', (uid: string) => setTypingUser(uid));
    socket.on('user_stop_typing', () => setTypingUser(null));

    return () => {
      socket.removeAllListeners();
      if (socket.connected) socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handleConnect = () => {
      if (!conversationId) return;
      socket.emit('join_conversation', conversationId);
      void onNewMessage(conversationId);
    };
    if (socket.connected) handleConnect();
    socket.on('connect', handleConnect);
    const handleNewMessage = (msg: unknown) => {
      const convId = (msg as { conversationId?: string } | null)?.conversationId;
      if (!convId || convId === conversationId) {
        const target = convId || conversationId;
        if (target) onNewMessage(target);
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('new_message', handleNewMessage);
    };
  }, [conversationId, onNewMessage]);

  /** Tell the other side the user is typing (stops by itself after a pause). */
  const notifyTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId || !enabled) return;
    const userId = safeStorage.json<{ id?: string }>('user', {})?.id || 'me';
    socket.emit('typing', { conversationId, userId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId, userId });
    }, 900);
  }, [conversationId, enabled]);

  return { connected, typingUser, notifyTyping };
}
