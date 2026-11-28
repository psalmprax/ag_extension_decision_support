import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { alertReviewService } from '@/api/alertReviewService';
import { AlertsToReviewCard } from '../AlertsToReviewCard';

vi.mock('@/api/alertReviewService', () => ({
  REVIEW_MESSAGE_MAX: 300,
  alertReviewService: { list: vi.fn(), send: vi.fn(), dismiss: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('alerts to review', () => {
  it('sends only the officer’s own words, once they have written some', async () => {
    vi.mocked(alertReviewService.list).mockResolvedValue([{
      id: 'a1', type: 'crop_stress', severity: 'medium', title: 'Less green than normal: River plot (Maize)',
      description: 'October 2026: greenness 1.4 standard deviations below the normal.', triggered_at: '2026-11-05T00:00:00Z', my_farmers: 1,
    }]);
    vi.mocked(alertReviewService.send).mockResolvedValue({ alertId: 'm1', farmers: 1, textingOn: false });
    wrap(<AlertsToReviewCard />);
    const box = await screen.findByLabelText('Your message to your 1 farmer(s), after checking');
    const send = screen.getByRole('button', { name: 'Send to my farmers' });
    expect(send).toBeDisabled();
    fireEvent.change(box, { target: { value: 'Mulch the maize rows this week.' } });
    fireEvent.click(send);
    await waitFor(() => expect(alertReviewService.send).toHaveBeenCalledWith('a1', 'Mulch the maize rows this week.'));
  });

  it('says what will appear when there is nothing to review', async () => {
    vi.mocked(alertReviewService.list).mockResolvedValue([]);
    wrap(<AlertsToReviewCard />);
    expect(await screen.findByText(/Nothing to review\./)).toBeInTheDocument();
  });
});
