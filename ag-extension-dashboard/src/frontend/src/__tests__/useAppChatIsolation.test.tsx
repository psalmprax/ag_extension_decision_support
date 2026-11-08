import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppChat } from '../hooks/useAppChat';
import { fetchMessages } from '@/api/chatbotService';
import { getPublicDemoChatCompletion } from '@/api/aiService';
import { Farmer } from '../types/dashboard';

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

  it('restores demo history and rejects replies from an earlier selection generation', async () => {
    let resolveStaleReply!: (value: { success: boolean; data: { text: string } }) => void;
    vi.mocked(getPublicDemoChatCompletion)
      .mockImplementationOnce(() => new Promise(resolve => { resolveStaleReply = resolve; }))
      .mockResolvedValueOnce({ success: true, data: { text: 'Current reply' } });
    const { result } = renderHook(() => useAppChat('en'));
    const farmerA: Farmer = { id: 'demo-farmer-a', firstName: 'Amina', lastName: 'A' };
    const farmerB: Farmer = { id: 'demo-farmer-b', firstName: 'Baraka', lastName: 'B' };

    await act(async () => { await result.current.handleStartConversation(farmerA); });
    const conversationA = result.current.activeFarmerConvId!;
    act(() => result.current.setFarmerChatInput('First question'));
    await act(async () => { await result.current.handleFarmerChatSend(); });
    expect(result.current.farmerChatMessages.map(message => message.content)).toEqual([
      'Jambo! I would like some advice on my farm.',
      'First question',
    ]);

    await act(async () => { await result.current.handleStartConversation(farmerB); });
    await act(async () => { await result.current.handleStartConversation(farmerA); });
    expect(result.current.activeFarmerConvId).toBe(conversationA);
    expect(result.current.farmerChatMessages.map(message => message.content)).toEqual([
      'Jambo! I would like some advice on my farm.',
      'First question',
    ]);

    await act(async () => {
      resolveStaleReply({ success: true, data: { text: 'Stale reply' } });
    });
    expect(result.current.farmerChatMessages.some(message => message.content === 'Stale reply')).toBe(false);

    act(() => result.current.setFarmerChatInput('Second question'));
    await act(async () => { await result.current.handleFarmerChatSend(); });
    expect(result.current.farmerChatMessages.at(-1)?.content).toBe('Current reply');
  });
});
