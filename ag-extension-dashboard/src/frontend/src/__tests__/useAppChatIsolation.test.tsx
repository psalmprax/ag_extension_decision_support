import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppChat } from '../hooks/useAppChat';
import { fetchMessages } from '@/api/chatbotService';

vi.mock('@/api/chatbotService', () => ({
  fetchConversations: vi.fn(), fetchMessages: vi.fn(), updateConversation: vi.fn(),
  deleteConversation: vi.fn(), createConversation: vi.fn(),
}));
vi.mock('@/api/aiService', () => ({ getChatCompletion: vi.fn(), getPublicDemoChatCompletion: vi.fn() }));

describe('Farmer conversation isolation', () => {
  it('clears prior messages immediately and ignores stale loads and reloads', async () => {
    let resolveOld!: (value: { success: boolean; data: { role: 'user'; content: string }[] }) => void;
    vi.mocked(fetchMessages)
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ success: true, data: [{ role: 'user', content: 'New farmer message' }] });
    const { result } = renderHook(() => useAppChat('en'));

    act(() => {
      result.current.setActiveFarmerConvId('old');
      void result.current.loadFarmerMessages('old');
    });
    await act(async () => {
      result.current.setActiveFarmerConvId('new');
      await result.current.loadFarmerMessages('new');
    });
    expect(result.current.farmerChatMessages[0].content).toBe('New farmer message');
    await act(async () => resolveOld({ success: true, data: [{ role: 'user', content: 'Old farmer message' }] }));
    await act(async () => result.current.loadFarmerMessages('old'));
    expect(result.current.farmerChatMessages[0].content).toBe('New farmer message');
    expect(fetchMessages).toHaveBeenCalledTimes(2);
    act(() => result.current.setActiveFarmerConvId('third'));
    expect(result.current.farmerChatMessages).toEqual([]);
  });
});
