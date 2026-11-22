import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { VoiceLibrarySection } from '../components/voice/VoiceLibrarySection';

const library = {
  clips: [{ id: 'c1', key: 'advisory:fall-armyworm', language: 'sw', title: 'Fall armyworm scouting', transcript: 'Check the funnel of the maize', url: '/api/v1/upload/file/c1.mp3', canChange: true }],
  prompts: { line_greeting: 'Welcome to your extension service.', line_thanks: 'Thank you.', line_not_registered: 'Not registered.' },
  callingConfigured: true,
  dailyCallLimit: 200,
};

describe('voice recordings', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    useAppStore.setState({ user: { id: 'm1', role: 'regional_manager' } as never });
    api.get.mockImplementation((url: string) => Promise.resolve({ data: { data: url === '/voice-clips' ? library : [
      { id: 'p1', name: 'Mzuzu maize 2027', status: 'running' },
    ] } }));
  });

  it('lists recordings and calls a pilot’s service group with an advisory', async () => {
    render(<VoiceLibrarySection active />);
    expect(await screen.findByText('Check the funnel of the maize')).toBeInTheDocument();
    api.post.mockResolvedValue({ data: { data: { queued: 118, skipped: 2 } } });
    fireEvent.click(screen.getByRole('button', { name: 'Call Mzuzu maize 2027' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/voice-clips/c1/call', { pilotId: 'p1' }));
  });

  it('shows the words to record for a voice-line prompt', async () => {
    render(<VoiceLibrarySection active />);
    expect(await screen.findByText(/Welcome to your extension service\./)).toBeInTheDocument();
  });

  it("offers delete only on the manager's own recordings", async () => {
    const other = { ...library.clips[0], id: 'c2', title: 'Striga control', transcript: 'Pull before flowering', canChange: false };
    api.get.mockImplementation((url: string) => Promise.resolve({ data: { data: url === '/voice-clips' ? { ...library, clips: [library.clips[0], other] } : [] } }));
    render(<VoiceLibrarySection active />);
    expect(await screen.findByText('Pull before flowering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Fall armyworm scouting' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Striga control' })).not.toBeInTheDocument();
  });

  it('is not shown to officers', () => {
    useAppStore.setState({ user: { id: 'o1', role: 'extension_officer' } as never });
    const { container } = render(<VoiceLibrarySection active />);
    expect(container).toBeEmptyDOMElement();
  });
});
