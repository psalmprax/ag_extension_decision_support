import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FarmerOfficerChatPage } from '@/pages/FarmerOfficerChatPage';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { askAiInThread, createConversation, fetchTurnTakingSettings, sendThreadMessage } from '@/api/chatbotService';
import { useAppStore } from '@/store/useAppStore';
import type { ThreadPageProps } from '@/components/chat/threadProps';

vi.mock('@/api/chatbotService', () => ({
  createConversation: vi.fn(), sendThreadMessage: vi.fn(), askAiInThread: vi.fn(),
  fetchTurnTakingSettings: vi.fn(),
  markThreadRead: vi.fn().mockResolvedValue(undefined), fetchUnreadSummary: vi.fn().mockResolvedValue({ total: 0, conversations: {} }),
}));
vi.mock('@/hooks/useConversationRealtime', () => ({
  useConversationRealtime: () => ({ connected: true, typingUser: null, notifyTyping: vi.fn() }),
}));

const withQuery = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

function renderPage(overrides: Partial<ThreadPageProps> = {}) {
  vi.mocked(fetchTurnTakingSettings).mockResolvedValue({
    tenantId: 't1',
    settings: { aiFallbackMinutes: 30, workingHours: { start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5, 6], timezone: 'Africa/Nairobi' }, aiPauseAfterOfficerMinutes: 120, smsAiDailyLimit: 10 },
  });
  const props: ThreadPageProps = {
    farmerConversations: [],
    activeFarmerConvId: null,
    setActiveFarmerConvId: vi.fn(),
    loadFarmerMessages: vi.fn(),
    farmerChatMessages: [],
    farmerChatInput: '',
    setFarmerChatInput: vi.fn(),
    handleFarmerChatSend: vi.fn(),
    ...overrides,
  };
  withQuery(<FarmerOfficerChatPage {...props} />);
  return props;
}

afterEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ user: null } as never);
});

describe("the farmer's chat with their officer", () => {
  it('shows their own thread, labelled from their side, with Ask AI and no officer tools', async () => {
    renderPage({
      farmerConversations: [{ id: 'thread-1', title: '', officerName: 'Grace Achieng', updatedAt: '', startedAt: '' }],
      activeFarmerConvId: 'thread-1',
      farmerChatMessages: [
        { role: 'user', content: 'Yellow leaves on my maize' },
        { role: 'officer', content: 'Since when?' },
        { role: 'assistant', content: 'Possibly nitrogen deficiency.' },
      ],
    });

    expect(screen.getByText('Grace Achieng')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'You message' })).toHaveTextContent('Yellow leaves on my maize');
    expect(screen.getByRole('group', { name: 'Officer message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeInTheDocument();
    expect(await screen.findByText(/usually replies within 30 minutes/)).toBeInTheDocument();
    // Officer-only tools are absent.
    expect(screen.queryByRole('button', { name: /draft a reply/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Telemetry|Hazard|Copilot/)).not.toBeInTheDocument();
  });

  it('starts the thread with their officer on the first message', async () => {
    vi.mocked(createConversation).mockResolvedValue({ success: true, data: { id: 'new-thread' } });
    vi.mocked(sendThreadMessage).mockResolvedValue({ success: true });
    const props = renderPage({ farmerChatInput: 'Hello, my beans are wilting' });

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(sendThreadMessage).toHaveBeenCalledWith('new-thread', 'Hello, my beans are wilting', 'en'));
    expect(createConversation).toHaveBeenCalledWith({ kind: 'farmer_thread', language: 'en' });
    expect(props.setActiveFarmerConvId).toHaveBeenCalledWith('new-thread');
    expect(props.handleFarmerChatSend).not.toHaveBeenCalled();
  });

  it('reloads the selected thread when the page opens', async () => {
    const loadFarmerMessages = vi.fn();
    renderPage({
      farmerConversations: [{ id: 'thread-1', title: '', updatedAt: '', startedAt: '' }],
      activeFarmerConvId: 'thread-1',
      loadFarmerMessages,
    });

    await waitFor(() => expect(loadFarmerMessages).toHaveBeenCalledWith('thread-1'));
  });

  it('reloads the new thread after asking AI on the first question', async () => {
    vi.mocked(createConversation).mockResolvedValue({ success: true, data: { id: 'new-thread' } });
    vi.mocked(askAiInThread).mockResolvedValue({ success: true });
    const loadFarmerMessages = vi.fn();
    renderPage({ farmerChatInput: 'Why are my maize leaves yellow?', loadFarmerMessages });

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    await waitFor(() => expect(loadFarmerMessages).toHaveBeenCalledWith('new-thread'));
    expect(askAiInThread).toHaveBeenCalledWith('new-thread');
  });

  it('disables the input while the first message is being sent', async () => {
    vi.mocked(createConversation).mockResolvedValue({ success: true, data: { id: 'new-thread' } });
    let resolveSend!: (value: { success: boolean }) => void;
    vi.mocked(sendThreadMessage).mockImplementation(() => new Promise(resolve => { resolveSend = resolve; }));
    renderPage({ farmerChatInput: 'Hello, my beans are wilting' });

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(sendThreadMessage).toHaveBeenCalled());
    expect(screen.getByLabelText('Message to your officer')).toBeDisabled();
    await act(async () => resolveSend({ success: true }));
  });

  it('sends later messages through the usual thread send (with its offline queue)', async () => {
    const props = renderPage({
      farmerConversations: [{ id: 'thread-1', title: '', updatedAt: '', startedAt: '' }],
      activeFarmerConvId: 'thread-1',
      farmerChatInput: 'Thanks',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(props.handleFarmerChatSend).toHaveBeenCalled());
    expect(createConversation).not.toHaveBeenCalled();
  });
});

describe("the farmer's mobile tabs", () => {
  it('offer their own pages, not the officers\' ones', () => {
    useAppStore.setState({ user: { id: 'f1', email: 'f1@test.dev', role: 'farmer', planName: 'pro' } as never });
    render(<MobileBottomNav activeTab="farmer_dashboard" setActiveTab={vi.fn()} sidebarOpen={false} setSidebarOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: /My officer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Farmers/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /AI scan/ })).not.toBeInTheDocument();
  });
});
