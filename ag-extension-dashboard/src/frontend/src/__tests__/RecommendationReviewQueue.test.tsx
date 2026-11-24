import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecommendationReviewQueue } from '@/components/RecommendationReviewQueue';
import { addReviewedAdviceToKnowledge, fetchRecommendationReviews, updateRecommendationReview } from '@/api/recommendationReviewService';

vi.mock('@/api/recommendationReviewService', () => ({
  fetchRecommendationReviews: vi.fn(),
  updateRecommendationReview: vi.fn(),
  addReviewedAdviceToKnowledge: vi.fn(),
}));

const mockFetch = fetchRecommendationReviews as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = updateRecommendationReview as unknown as ReturnType<typeof vi.fn>;
const mockAddToKnowledge = addReviewedAdviceToKnowledge as unknown as ReturnType<typeof vi.fn>;
const ADVICE = 'Scout 20 plants in a W pattern each week and record the share with fresh damage and live larvae; confirm the local threshold with the extension office.';

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
    mockAddToKnowledge.mockReset();
    addNotification.mockReset();
  });

  const approve = async (recommendation = item.recommendation) => {
    mockFetch.mockResolvedValue({ success: true, data: [{ ...item, recommendation }] });
    mockUpdate.mockResolvedValue({ success: true, data: { ...item, status: 'approved' } });
    render(<RecommendationReviewQueue addNotification={addNotification} />);
    fireEvent.change(await screen.findByLabelText('Reason for your decision'), { target: { value: 'Matches the county scouting guide.' } });
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await screen.findByRole('heading', { name: 'Approved. Add this advice to the knowledge base?' });
  };

  it('after approving, offers to add the advice to the knowledge base, prefilled and editable', async () => {
    await approve(ADVICE);
    expect(screen.getByLabelText('Advice')).toHaveValue(ADVICE);
    mockAddToKnowledge.mockResolvedValue({ success: true, data: { knowledgeArticleId: 'a1', pendingReview: true } });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fall armyworm scouting' } });
    fireEvent.change(screen.getByLabelText('Crops'), { target: { value: 'maize, sorghum ' } });
    fireEvent.change(screen.getByLabelText('Sources (optional)'), { target: { value: 'County scouting guide 2024' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to knowledge base/ }));

    await waitFor(() => expect(mockAddToKnowledge).toHaveBeenCalledWith('r1', {
      title: 'Fall armyworm scouting', content: ADVICE, crops: ['maize', 'sorghum'], sources: 'County scouting guide 2024',
    }));
    expect(addNotification).toHaveBeenCalledWith({ type: 'success', message: 'Added. It will answer questions once a manager approves the document.' });
    await waitFor(() => expect(screen.queryByText(ADVICE)).not.toBeInTheDocument());
  });

  it('asks for a title and enough advice before sending', async () => {
    await approve(ADVICE);
    fireEvent.click(screen.getByRole('button', { name: /Add to knowledge base/ }));
    expect(mockAddToKnowledge).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith({ type: 'warning', message: 'Give it a title and at least 80 characters of advice.' });
  });

  it("shows the API's refusal, e.g. the farmer's name is still in the text, and keeps the form", async () => {
    await approve(ADVICE);
    mockAddToKnowledge.mockRejectedValue({ response: { status: 400, data: { error: "Remove the farmer's name first" } } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fall armyworm scouting' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to knowledge base/ }));
    await waitFor(() => expect(addNotification).toHaveBeenCalledWith({ type: 'error', message: "Remove the farmer's name first" }));
    expect(screen.getByLabelText('Advice')).toBeInTheDocument();
  });

  it('can be closed without adding anything', async () => {
    await approve(ADVICE);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(mockAddToKnowledge).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText('Advice')).not.toBeInTheDocument());
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
