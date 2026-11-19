import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { FarmerAskAi } from '@/components/chat/FarmerAskAi';
import { ChatTurnTakingSection } from '@/components/settings/ChatTurnTakingSection';
import { askAiInThread, fetchTurnTakingSettings, saveTurnTakingSettings, sendThreadMessage, type TurnTakingSettings } from '@/api/chatbotService';
import { dayRangeLabel, officerReplyExpectation } from '@/lib/turnTakingText';

vi.mock('@/api/chatbotService', () => ({
  askAiInThread: vi.fn(), sendThreadMessage: vi.fn(), fetchTurnTakingSettings: vi.fn(), saveTurnTakingSettings: vi.fn(),
  markThreadRead: vi.fn().mockResolvedValue(undefined), fetchUnreadSummary: vi.fn().mockResolvedValue({ total: 0, conversations: {} }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const settings: TurnTakingSettings = {
  aiFallbackMinutes: 30,
  workingHours: { start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5, 6], timezone: 'Africa/Nairobi' },
  aiPauseAfterOfficerMinutes: 120,
  smsAiDailyLimit: 10,
};

const withQuery = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

afterEach(() => vi.clearAllMocks());

describe('what the farmer is told to expect', () => {
  it('describes the working days and wait', () => {
    expect(dayRangeLabel([1, 2, 3, 4, 5, 6])).toBe('Mon–Sat');
    expect(dayRangeLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(dayRangeLabel([0, 1, 2, 3, 4, 5, 6])).toBe('every day');
    expect(officerReplyExpectation(settings)).toBe(
      'Your officer usually replies within 30 minutes (08:00–17:00, Mon–Sat). Tap Ask AI for an answer now.',
    );
  });
});

describe("the farmer's Ask AI button", () => {
  const renderButton = (input = '') => {
    vi.mocked(fetchTurnTakingSettings).mockResolvedValue({ tenantId: 't1', settings });
    const clearInput = vi.fn();
    const reload = vi.fn();
    const ensureConversation = vi.fn().mockResolvedValue('thread-1');
    withQuery(<FarmerAskAi ensureConversation={ensureConversation} input={input} clearInput={clearInput} language="en" reload={reload} />);
    return { clearInput, reload };
  };

  it('sends what the farmer typed, then asks the AI to answer it', async () => {
    vi.mocked(sendThreadMessage).mockResolvedValue({ success: true });
    vi.mocked(askAiInThread).mockResolvedValue({ success: true });
    const { clearInput, reload } = renderButton('Yellow leaves on maize');

    expect(await screen.findByText(/usually replies within 30 minutes/)).toHaveAttribute('role', 'note');
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(reload).toHaveBeenCalledWith('thread-1');
    expect(sendThreadMessage).toHaveBeenCalledWith('thread-1', 'Yellow leaves on maize', 'en');
    expect(clearInput).toHaveBeenCalled();
    expect(askAiInThread).toHaveBeenCalledWith('thread-1');
    expect(vi.mocked(sendThreadMessage).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(askAiInThread).mock.invocationCallOrder[0]);
  });

  it("shows the server's reason when the AI cannot answer", async () => {
    const conflict = new AxiosError('conflict', '409', undefined, undefined, {
      status: 409, data: { error: 'The AI has already answered your latest message.' },
    } as AxiosResponse);
    vi.mocked(askAiInThread).mockRejectedValue(conflict);
    renderButton();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask AI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already answered your latest message');
    expect(sendThreadMessage).not.toHaveBeenCalled();
  });
});

describe("the admin's farmer chat settings", () => {
  it("saves the organisation's rules", async () => {
    vi.mocked(fetchTurnTakingSettings).mockResolvedValue({ tenantId: 't1', settings });
    vi.mocked(saveTurnTakingSettings).mockImplementation(async (saved, tenantId) => ({ tenantId: tenantId!, settings: saved }));
    withQuery(<ChatTurnTakingSection tenantId="org-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Sat' }));
    fireEvent.change(screen.getByLabelText(/Wait for the officer/), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save farmer chat settings' }));

    await waitFor(() => expect(saveTurnTakingSettings).toHaveBeenCalled());
    expect(saveTurnTakingSettings).toHaveBeenCalledWith(
      { ...settings, aiFallbackMinutes: 45, workingHours: { ...settings.workingHours, days: [1, 2, 3, 4, 5] } },
      'org-1',
    );
  });
});
