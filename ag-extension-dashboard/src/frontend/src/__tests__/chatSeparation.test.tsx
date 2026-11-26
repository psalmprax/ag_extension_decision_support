import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppChat } from '../hooks/useAppChat';
import { fetchConversations, fetchMessages, sendThreadMessage } from '@/api/chatbotService';
import { getChatCompletion, getCopilotDraft } from '@/api/aiService';
import { useAppStore } from '@/store/useAppStore';
import { OfficerCopilot } from '@/components/chat/OfficerCopilot';
import { lastFarmerMessage } from '@/lib/farmerChatSender';
import type { ChatMessage } from '../types/dashboard';

vi.mock('@/api/chatbotService', () => ({
  fetchConversations: vi.fn(), fetchMessages: vi.fn(), updateConversation: vi.fn(),
  deleteConversation: vi.fn(), createConversation: vi.fn(), sendThreadMessage: vi.fn(),
  markThreadRead: vi.fn().mockResolvedValue(undefined), fetchUnreadSummary: vi.fn().mockResolvedValue({ total: 0, conversations: {} }),
}));
vi.mock('@/api/aiService', () => ({
  getChatCompletion: vi.fn(), getPublicDemoChatCompletion: vi.fn(), getCopilotDraft: vi.fn(),
}));

const signInAs = (role: string) =>
  useAppStore.setState({ user: { id: 'u1', email: 'u1@test.dev', role, planName: 'Pro', isFree: false } as never });

afterEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ user: null } as never);
});

async function sendInThread(text: string) {
  vi.mocked(fetchMessages).mockResolvedValue({ success: true, data: [] });
  vi.mocked(fetchConversations).mockResolvedValue({ success: true, data: [] });
  const { result } = renderHook(() => useAppChat('en'));
  act(() => {
    result.current.setActiveFarmerConvId('thread-1');
    result.current.setFarmerChatInput(text);
  });
  await act(async () => { await result.current.handleFarmerChatSend(); });
  return result;
}

describe('messages in a farmer thread', () => {
  it('go out as plain messages and never ask the AI', async () => {
    signInAs('extension_officer');
    vi.mocked(sendThreadMessage).mockResolvedValue({ success: true });
    await sendInThread('How many acres did you plant?');

    expect(sendThreadMessage).toHaveBeenCalledWith('thread-1', 'How many acres did you plant?', 'en', undefined, undefined, undefined);
    expect(getChatCompletion).not.toHaveBeenCalled();
  });

  it("a farmer's message is a plain message too: the AI answers on its turn", async () => {
    signInAs('farmer');
    vi.mocked(sendThreadMessage).mockResolvedValue({ success: true });
    await sendInThread('My maize leaves are yellow');

    expect(sendThreadMessage).toHaveBeenCalledWith('thread-1', 'My maize leaves are yellow', 'en', undefined, undefined, undefined);
    expect(getChatCompletion).not.toHaveBeenCalled();
  });
});

describe('conversation lists', () => {
  it.each([
    ['extension_officer', 'officer_ai'],
    ['admin', 'officer_ai'],
    ['farmer', 'farmer_thread'],
  ])('a %s loads %s chats as their AI history, and farmer threads for Farmer Chat', async (role, aiKind) => {
    signInAs(role);
    vi.mocked(fetchConversations).mockResolvedValue({ success: true, data: [] });
    const { result } = renderHook(() => useAppChat('en'));
    await act(async () => { await result.current.loadConversations(); });
    await act(async () => { await result.current.loadFarmerConversations(); });

    expect(vi.mocked(fetchConversations).mock.calls.map(call => call[0])).toEqual([aiKind, 'farmer_thread']);
  });
});

describe('officer copilot', () => {
  const thread: ChatMessage[] = [
    { role: 'user', content: 'My maize leaves are yellow', timestamp: '2026-11-17T08:00:00Z' },
    { role: 'officer', content: 'Since when?', timestamp: '2026-11-17T08:05:00Z' },
  ];

  it("reads the farmer's last message, not the officer's own reply", () => {
    expect(lastFarmerMessage(thread)).toBe('My maize leaves are yellow');
    expect(lastFarmerMessage([{ role: 'farmer', content: 'legacy role' }])).toBe('legacy role');
    expect(lastFarmerMessage([{ role: 'officer', content: 'only me' }])).toBeNull();
  });

  it('shows a private draft that only fills the message box', async () => {
    vi.mocked(getChatCompletion).mockRejectedValue(new Error('no suggestions in this test'));
    vi.mocked(getCopilotDraft).mockResolvedValue({ text: 'Thanks. When did the yellowing start, and on which leaves?', sources: [], evidence: 'general' });
    const onUseText = vi.fn();
    render(<OfficerCopilot conversationId="thread-1" messages={thread} language="en" onUseText={onUseText} />);

    fireEvent.click(screen.getByRole('button', { name: /draft a reply/i }));
    const draft = await screen.findByRole('region', { name: 'AI draft reply' });
    expect(draft).toHaveTextContent('only you can see this');
    expect(getCopilotDraft).toHaveBeenCalledWith('thread-1', expect.stringContaining('Draft a short'), 'en');

    fireEvent.click(screen.getByRole('button', { name: 'Use draft' }));
    expect(onUseText).toHaveBeenCalledWith('Thanks. When did the yellowing start, and on which leaves?');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'AI draft reply' })).not.toBeInTheDocument());
    expect(sendThreadMessage).not.toHaveBeenCalled();
  });
});
