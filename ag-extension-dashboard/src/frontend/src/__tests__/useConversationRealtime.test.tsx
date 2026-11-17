import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';

const { mockSocket, mockIo } = vi.hoisted(() => {
  const socket = {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    close: vi.fn(),
  };
  return { mockSocket: socket, mockIo: vi.fn(() => socket) };
});

vi.mock('socket.io-client', () => ({ io: mockIo }));

afterEach(() => {
  vi.clearAllMocks();
  mockSocket.connected = false;
});

describe('useConversationRealtime', () => {
  it('rejoins and refreshes the conversation on every socket connection', () => {
    const onNewMessage = vi.fn();
    renderHook(() => useConversationRealtime({
      conversationId: 'thread-1',
      enabled: true,
      onNewMessage,
    }));

    const connect = mockSocket.on.mock.calls.filter(([event]) => event === 'connect').at(-1)?.[1] as (() => void) | undefined;
    expect(connect).toBeDefined();

    act(() => connect?.());
    act(() => connect?.());

    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'thread-1');
    expect(onNewMessage).toHaveBeenCalledTimes(2);
    expect(onNewMessage).toHaveBeenCalledWith('thread-1');
  });
});
