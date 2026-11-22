import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useThreadHistory } from '@/hooks/useThreadHistory';
import { fetchMessages } from '@/api/chatbotService';
import type { ChatMessage } from '@/types/dashboard';

vi.mock('@/api/chatbotService', () => ({ fetchMessages: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const msg = (id: string, content: string): ChatMessage => ({ id, role: 'user', content });

function useThread(initial: ChatMessage[]) {
  const activeId = useRef<string | null>('thread-1');
  const [messages, setMessages] = useState(initial);
  return { activeId, messages, history: useThreadHistory(activeId, messages, setMessages) };
}

describe('useThreadHistory', () => {
  it('puts the page before the oldest message shown in front of it', async () => {
    vi.mocked(fetchMessages).mockResolvedValueOnce({ success: true, data: [msg('m1', 'Planted on Monday'), msg('m2', 'Rain came')], hasMore: false });
    const { result } = renderHook(() => useThread([msg('m3', 'Leaves are yellow'), msg('m4', 'Since when?')]));
    act(() => result.current.history.setHasEarlier(true));

    await act(async () => { await result.current.history.loadEarlier(); });

    expect(fetchMessages).toHaveBeenCalledWith('thread-1', 'm3');
    expect(result.current.messages.map(m => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(result.current.history.hasEarlier).toBe(false);
  });

  it('drops the page when another thread was opened while it loaded', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(fetchMessages).mockReturnValueOnce(new Promise(r => { resolve = r; }) as never);
    const { result } = renderHook(() => useThread([msg('m3', 'Leaves are yellow')]));
    let loading!: Promise<void>;
    act(() => { loading = result.current.history.loadEarlier(); });
    result.current.activeId.current = 'thread-2';
    await act(async () => { resolve({ success: true, data: [msg('m1', 'Other farmer')], hasMore: false }); await loading; });

    expect(result.current.messages.map(m => m.id)).toEqual(['m3']);
  });
});
