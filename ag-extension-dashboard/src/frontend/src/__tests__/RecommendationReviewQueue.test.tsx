import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecommendationReviewQueue } from '@/components/RecommendationReviewQueue';
import { fetchRecommendationReviews, updateRecommendationReview } from '@/api/recommendationReviewService';

vi.mock('@/api/recommendationReviewService', () => ({
  fetchRecommendationReviews: vi.fn(),
  updateRecommendationReview: vi.fn(),
}));

const mockFetch = fetchRecommendationReviews as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = updateRecommendationReview as unknown as ReturnType<typeof vi.fn>;

const item = {
  id: 'r1', farmer_id: 'f1', report_id: null, recommendation: 'Apply 50 kg/ha urea at knee height.',
  confidence: null, evidence_status: 'no_verified_source' as const, trigger: 'no_sources' as const,
  status: 'pending' as const, created_at: '2026-11-16T06:00:00Z',
};

describe('RecommendationReviewQueue', () => {
  const addNotification = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpdate.mockReset();
    addNotification.mockReset();
  });

  it('shows why each item was queued', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [item] });
    render(<RecommendationReviewQueue addNotification={addNotification} />);
    expect(await screen.findByText('Queued because: No supporting sources found')).toBeInTheDocument();
  });

  it('will not record a decision without a written reason', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [item] });
    render(<RecommendationReviewQueue addNotification={addNotification} />);
    fireEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith({ type: 'warning', message: 'Write the reason for your decision first.' });
  });

  it('saves the reviewer\'s own reason with the decision', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [item] });
    mockUpdate.mockResolvedValue({ success: true, data: { ...item, status: 'escalated' } });
    render(<RecommendationReviewQueue addNotification={addNotification} />);
    fireEvent.change(await screen.findByLabelText('Reason for your decision'), { target: { value: 'Rate exceeds the district recommendation; ask the soil lab.' } });
    fireEvent.click(screen.getByRole('button', { name: /Escalate/ }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('r1', 'escalated', 'Rate exceeds the district recommendation; ask the soil lab.'));
    await waitFor(() => expect(screen.queryByText(item.recommendation)).not.toBeInTheDocument());
  });

  it('shows the API\'s refusal, e.g. reviewing your own submission', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [item] });
    mockUpdate.mockRejectedValue({ response: { status: 403, data: { error: 'You cannot review a recommendation you submitted' } } });
    render(<RecommendationReviewQueue addNotification={addNotification} />);
    fireEvent.change(await screen.findByLabelText('Reason for your decision'), { target: { value: 'Looks right' } });
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(addNotification).toHaveBeenCalledWith({ type: 'error', message: 'You cannot review a recommendation you submitted' }));
    expect(screen.getByText(item.recommendation)).toBeInTheDocument();
  });

  it('renders nothing for users who do not review (403)', async () => {
    mockFetch.mockRejectedValue({ response: { status: 403 } });
    const { container } = render(<RecommendationReviewQueue addNotification={addNotification} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says so when the queue cannot be loaded, and can retry', async () => {
    mockFetch.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ success: true, data: [item] });
    render(<RecommendationReviewQueue addNotification={addNotification} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load recommendations awaiting review.');
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByText(item.recommendation)).toBeInTheDocument();
  });
});
