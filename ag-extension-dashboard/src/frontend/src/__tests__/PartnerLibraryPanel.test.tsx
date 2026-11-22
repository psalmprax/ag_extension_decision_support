import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { PartnerLibraryPanel } from '../components/partners/PartnerLibraryPanel';

const asRole = (role: string) => useAppStore.setState({ user: { id: 'u1', role, country: 'Kenya' } as never });
const draft = {
  id: 'rec-1', partnerId: 'p-1', partner: 'Farm Radio Trust', title: 'Scouting before you spray', speaker: 'Dr. Achieng',
  language: 'sw', crops: ['maize'], regions: [], topic: 'pests', licence: 'CC BY 4.0', licenceExpiresAt: null,
  transcript: 'Kagua shamba kila wiki kabla ya kunyunyizia dawa.', transcriptStatus: 'transcribed',
  reviewStatus: 'pending_review', deliveries: 0, url: '/api/v1/upload/file/k',
};
const reply = (recordings: unknown[]) => Promise.resolve({ data: { data: { recordings } } });

describe('Partner recordings panel', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('is hidden from farmers', () => {
    asRole('farmer');
    const { container } = render(<PartnerLibraryPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows officers only the approved library, never drafts or imports', async () => {
    asRole('extension_officer');
    api.get.mockImplementation(() => reply([]));
    render(<PartnerLibraryPanel />);
    expect(screen.queryByText('Waiting for review')).not.toBeInTheDocument();
    expect(screen.queryByText('Content partners and imports')).not.toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/partner-recordings', { params: { status: 'approved' } }));
  });

  it('lets a regional manager approve a draft with the checked transcript', async () => {
    asRole('regional_manager');
    api.get.mockImplementation((_url: string, options?: { params?: { status?: string } }) =>
      reply(options?.params?.status === 'pending_review' ? [draft] : []));
    api.post.mockResolvedValue({ data: { data: { ...draft, reviewStatus: 'approved' } } });
    render(<PartnerLibraryPanel />);
    const transcript = await screen.findByLabelText(/check it against the audio/);
    expect(screen.getByText(/Dr\. Achieng, Farm Radio Trust/)).toBeInTheDocument();
    fireEvent.change(transcript, { target: { value: 'Kagua shamba lako kila wiki kabla ya kuamua kunyunyizia dawa.' } });
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/partner-recordings/rec-1/review', {
      decision: 'approve', transcript: 'Kagua shamba lako kila wiki kabla ya kuamua kunyunyizia dawa.',
    }));
  });
});
