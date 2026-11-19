import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const chatApi = vi.hoisted(() => ({
  fetchConversations: vi.fn(),
  fetchMessages: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  createConversation: vi.fn(),
  sendThreadMessage: vi.fn(),
  markThreadRead: vi.fn().mockResolvedValue(undefined),
  fetchUnreadSummary: vi.fn().mockResolvedValue({ total: 0, conversations: {} }),
}));

const aiApi = vi.hoisted(() => ({
  getChatCompletion: vi.fn(),
  getPublicDemoChatCompletion: vi.fn(),
}));

// Chat is a Pro feature: the default user is on a paid plan.
const store = vi.hoisted(() => ({
  user: { role: 'officer', planName: 'Pro', isFree: false } as { role: string; planName?: string; isFree?: boolean } | null,
}));

vi.mock('@/api/chatbotService', () => chatApi);
vi.mock('@/api/aiService', () => aiApi);
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: store.user }),
}));
vi.mock('@/demo/demoIds', () => ({
  isDemoFarmerId: (id: string) => id.startsWith('demo-farmer-'),
}));

import { useAppChat } from '@/hooks/useAppChat';
import type { ChatMessage, Conversation, Farmer } from '@/types/dashboard';

function conversation(id: string, farmerId?: string): Conversation {
  return {
    id,
    title: `Thread ${id}`,
    farmerId,
    farmerName: 'Grace Wanjiru',
    lastMessage: 'hello',
    updatedAt: '2026-01-01T00:00:00Z',
    startedAt: '2026-01-01T00:00:00Z',
  };
}

function message(content: string, role: 'officer' | 'assistant' = 'officer'): ChatMessage {
  return { role, content, timestamp: '2026-01-01T00:00:00Z' };
}

function farmer(id: string): Farmer {
  return {
    id,
    firstName: 'Grace',
    lastName: 'Wanjiru',
    crops: ['maize'],
  };
}

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  store.user = { role: 'officer', planName: 'Pro', isFree: false };
  setOnline(true);
  chatApi.fetchConversations.mockResolvedValue({ data: [] });
  chatApi.fetchMessages.mockResolvedValue({ data: [] });
  chatApi.updateConversation.mockResolvedValue({ success: true });
  chatApi.deleteConversation.mockResolvedValue({ success: true });
  chatApi.createConversation.mockResolvedValue({ success: true, data: conversation('new') });
  chatApi.sendThreadMessage.mockResolvedValue({ success: true });
  aiApi.getChatCompletion.mockResolvedValue({ success: true });
  aiApi.getPublicDemoChatCompletion.mockResolvedValue({ data: { text: 'AI reply' } });
});

afterEach(() => {
  vi.useRealTimers();
  if (originalOnLine) {
    Object.defineProperty(navigator, 'onLine', originalOnLine);
  }
});

describe('useAppChat conversation loading', () => {
  it('loads officer AI chats and auto-selects the newest', async () => {
    chatApi.fetchConversations.mockResolvedValue({
      data: [conversation('c1'), conversation('c2')],
    });
    const { result } = renderHook(() => useAppChat('en'));

    await act(async () => {
      await result.current.loadConversations();
    });

    expect(chatApi.fetchConversations).toHaveBeenCalledWith('officer_ai');
    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.activeConvId).toBe('c1');
  });

  it('requests no conversations for a free-plan user (the page shows the upgrade card)', async () => {
    store.user = { role: 'officer', planName: 'Free', isFree: true };
    const { result } = renderHook(() => useAppChat('en'));

    await act(async () => {
      await result.current.loadConversations();
      await result.current.loadFarmerConversations();
    });

    expect(chatApi.fetchConversations).not.toHaveBeenCalled();
  });

  it('requests farmer threads instead of private copilot chats for a farmer account', async () => {
    store.user = { role: 'farmer', planName: 'Pro', isFree: false };
    const { result } = renderHook(() => useAppChat('en'));

    await act(async () => {
      await result.current.loadConversations();
    });

    expect(chatApi.fetchConversations).toHaveBeenCalledWith('farmer_thread');
  });

  it('auto-selects a farmer thread and shows its history', async () => {
    chatApi.fetchConversations.mockResolvedValue({ data: [conversation('t1', 'f1')] });
    chatApi.fetchMessages.mockResolvedValue({ data: [message('Jambo')] });
    const { result } = renderHook(() => useAppChat('en'));

    await act(async () => {
      await result.current.loadFarmerConversations();
    });

    await waitFor(() => expect(result.current.activeFarmerConvId).toBe('t1'));
    await waitFor(() => expect(result.current.farmerChatMessages).toHaveLength(1));
    expect(chatApi.fetchMessages).toHaveBeenCalledWith('t1');
  });

  it('ignores a stale messages response so the newly selected thread is not overwritten', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    chatApi.fetchMessages
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ data: [message('second thread')] });

    const { result } = renderHook(() => useAppChat('en'));

    act(() => {
      void result.current.loadMessages('a');
    });
    await act(async () => {
      await result.current.loadMessages('b');
    });
    await act(async () => {
      resolveFirst({ data: [message('stale first thread')] });
      await Promise.resolve();
    });

    expect(result.current.chatMessages).toEqual([message('second thread')]);
  });

  it('removes a deleted conversation and clears it when it was active', async () => {
    chatApi.fetchConversations.mockResolvedValue({ data: [conversation('c1')] });
    const { result } = renderHook(() => useAppChat('en'));
    await act(async () => {
      await result.current.loadConversations();
    });

    await act(async () => {
      await result.current.handleDeleteConversation('c1');
    });

    expect(chatApi.deleteConversation).toHaveBeenCalledWith('c1');
    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeConvId).toBeNull();
    expect(result.current.chatMessages).toEqual([]);
  });

  it('renames a conversation and closes the inline editor on success', async () => {
    chatApi.fetchConversations.mockResolvedValue({ data: [conversation('c1')] });
    const { result } = renderHook(() => useAppChat('en'));
    await act(async () => {
      await result.current.loadConversations();
    });
    act(() => result.current.setEditingConvId('c1'));

    await act(async () => {
      await result.current.updateConversationTitle('c1', 'Maize blight follow-up');
    });

    expect(result.current.conversations[0].title).toBe('Maize blight follow-up');
    expect(result.current.editingConvId).toBeNull();
  });
});

describe('useAppChat starting conversations', () => {
  it('reuses an existing thread instead of creating a duplicate', async () => {
    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setFarmerConversations([conversation('t1', 'f1')]);
    });

    let started = false;
    await act(async () => {
      started = await result.current.handleStartConversation(farmer('f1'), 'farmer');
    });

    expect(started).toBe(true);
    expect(chatApi.createConversation).not.toHaveBeenCalled();
    expect(result.current.activeFarmerConvId).toBe('t1');
  });

  it('builds a local demo thread for a demo farmer without calling the API', async () => {
    const { result } = renderHook(() => useAppChat('en'));

    await act(async () => {
      await result.current.handleStartConversation(farmer('demo-farmer-7'), 'farmer');
    });

    expect(chatApi.createConversation).not.toHaveBeenCalled();
    expect(result.current.activeFarmerConvId).toBe('conv-demo-farmer-7');
    expect(result.current.farmerChatMessages[0].content).toMatch(/Jambo/);
  });

  it('creates a real thread and selects it', async () => {
    chatApi.createConversation.mockResolvedValue({
      success: true,
      data: conversation('conv-real', 'f2'),
    });
    const { result } = renderHook(() => useAppChat('en'));

    await act(async () => {
      await result.current.handleStartConversation(farmer('f2'), 'farmer');
    });

    expect(chatApi.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ farmerId: 'f2', kind: 'farmer_thread' })
    );
    expect(result.current.farmerConversations[0].id).toBe('conv-real');
  });
});

describe('useAppChat sending', () => {
  it('sends a thread message as a plain message, never as an AI completion', async () => {
    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setActiveFarmerConvId('t1');
      result.current.setFarmerChatInput('My maize has streaks');
    });

    await act(async () => {
      await result.current.handleFarmerChatSend();
    });

    expect(chatApi.sendThreadMessage).toHaveBeenCalledWith(
      't1',
      'My maize has streaks',
      'en',
      undefined,
      undefined // no copilot draft behind this message
    );
    expect(aiApi.getChatCompletion).not.toHaveBeenCalled();
    expect(result.current.farmerChatInput).toBe('');
  });

  it('ignores an empty draft', async () => {
    const { result } = renderHook(() => useAppChat('en'));
    act(() => result.current.setActiveFarmerConvId('t1'));

    await act(async () => {
      await result.current.handleFarmerChatSend();
    });

    expect(chatApi.sendThreadMessage).not.toHaveBeenCalled();
  });

  it('queues the message in localStorage while offline instead of losing it', async () => {
    setOnline(false);
    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setActiveFarmerConvId('t1');
      result.current.setFarmerChatInput('queued while in the field');
    });

    await act(async () => {
      await result.current.handleFarmerChatSend();
    });

    const queued = JSON.parse(localStorage.getItem('chatOfflineQueue:t1') ?? '[]');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      conversationId: 't1',
      message: 'queued while in the field',
      via: 'message',
    });
    expect(chatApi.sendThreadMessage).not.toHaveBeenCalled();
  });

  it('queues after a network failure but reports a genuine server error', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chatApi.sendThreadMessage.mockRejectedValueOnce(new Error('Network request failed'));

    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setActiveFarmerConvId('t1');
      result.current.setFarmerChatInput('offline again');
    });
    await act(async () => {
      await result.current.handleFarmerChatSend();
    });
    expect(JSON.parse(localStorage.getItem('chatOfflineQueue:t1') ?? '[]')).toHaveLength(1);
    expect(consoleWarn).toHaveBeenCalled();

    chatApi.sendThreadMessage.mockRejectedValueOnce(new Error('422 unprocessable entity'));
    act(() => result.current.setFarmerChatInput('bad payload'));
    await act(async () => {
      await result.current.handleFarmerChatSend();
    });
    expect(consoleError).toHaveBeenCalled();
  });

  it('answers in a demo thread with the public demo completion', async () => {
    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setActiveFarmerConvId('conv-demo-farmer-1');
      result.current.setFarmerChatInput('What is eating my maize?');
    });

    await act(async () => {
      await result.current.handleFarmerChatSend();
    });

    expect(aiApi.getPublicDemoChatCompletion).toHaveBeenCalledWith(
      'What is eating my maize?',
      'en'
    );
    expect(result.current.farmerChatMessages.map(m => m.role)).toEqual([
      'officer',
      'assistant',
    ]);
  });

  it('drains the offline queue when connectivity returns', async () => {
    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setActiveFarmerConvId('t1');
    });
    localStorage.setItem(
      'chatOfflineQueue:t1',
      JSON.stringify([
        { conversationId: 't1', message: 'first', language: 'en', via: 'message' },
      ])
    );

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() =>
      expect(chatApi.sendThreadMessage).toHaveBeenCalledWith('t1', 'first', 'en')
    );
    await waitFor(() => expect(localStorage.getItem('chatOfflineQueue:t1')).toBeNull());
  });

  it('skips draining while another tab holds a fresh drain lock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { result } = renderHook(() => useAppChat('en'));
    act(() => {
      result.current.setActiveFarmerConvId('t1');
    });
    localStorage.setItem(
      'chatOfflineQueue:t1',
      JSON.stringify([
        { conversationId: 't1', message: 'first', language: 'en', via: 'message' },
      ])
    );
    // Another tab locked 1s ago; the TTL is 15s.
    localStorage.setItem('chatOfflineDrainLock', String(Date.now() - 1000));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(chatApi.sendThreadMessage).not.toHaveBeenCalled();
    expect(localStorage.getItem('chatOfflineQueue:t1')).not.toBeNull();
  });
});
