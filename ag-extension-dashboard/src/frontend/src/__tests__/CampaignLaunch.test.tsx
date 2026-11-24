import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { CampaignLaunch } from '@/components/campaigns/CampaignLaunch';

const target = { goalPrompt: 'Armyworm scouting', targetRegion: 'Nakuru', targetCrop: 'Maize' };
const renderLaunch = (onSent = vi.fn()) =>
  render(<CampaignLaunch target={target} channel="sms" autoScheduleVisits={false} onBusy={vi.fn()} onSent={onSent} />);

beforeEach(() => api.post.mockReset());

describe('a campaign is drafted, read and only then sent', () => {
  it('sends the officer’s edited text, not the AI draft', async () => {
    api.post
      .mockResolvedValueOnce({ data: { success: true, draftText: 'Check your maize this week.', affectedFarmersCount: 12, violations: [] } })
      .mockResolvedValueOnce({ data: { success: true, executionTrace: [], summary: 'sent' } });
    const onSent = vi.fn();
    renderLaunch(onSent);
    fireEvent.click(screen.getByRole('button', { name: 'Write a draft to check' }));
    const box = await screen.findByLabelText('Read and edit before it goes to 12 farmers');
    expect(api.post).toHaveBeenCalledWith('/campaigns/goal/draft', target);
    fireEvent.change(box, { target: { value: 'Check your maize for fresh damage and tell your officer.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to 12 farmers' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(api.post).toHaveBeenLastCalledWith('/campaigns/goal', expect.objectContaining({ message: 'Check your maize for fresh damage and tell your officer.' }));
  });

  it('will not send a draft that gives a rate until it is edited', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, draftText: 'Spray 20 ml per litre.', affectedFarmersCount: 5, violations: ['Treatment rate withheld'] } });
    renderLaunch();
    fireEvent.click(screen.getByRole('button', { name: 'Write a draft to check' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('rate, dose or waiting period');
    expect(screen.getByRole('button', { name: 'Send to 5 farmers' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ask your officer before you spray.' } });
    expect(screen.getByRole('button', { name: 'Send to 5 farmers' })).toBeEnabled();
  });
});
