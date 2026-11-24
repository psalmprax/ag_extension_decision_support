import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { PilotsSection } from '../components/pilots/PilotsSection';

const pilot = {
  id: 'p1', name: 'Mzuzu maize 2027', region: 'Mzuzu', country: 'Malawi', crop: 'maize',
  season_start: '2026-11-01', season_end: '2027-04-30', comparison_share: 0.5, bag_kg: 50, status: 'running',
};
const arm = (overrides: Record<string, unknown>) => ({
  farmers: 120, withBothHarvests: 12, baselineKgPerHa: 1500, endlineKgPerHa: 1800, meanChangeKgPerHa: 300,
  medianReplyMinutes: 45, followups: { asked: 40, yes: 24, partly: 8, no: 8 },
  use: { visits: 150, farmersVisited: 90, farmerMessages: 300, farmersMessaging: 60, officerReplies: 210, aiReplies: 40, adviceRecorded: 70, adviceReviewed: 12 },
  ...overrides,
});

describe('pilots', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    useAppStore.setState({ user: { id: 'm1', role: 'regional_manager', region: 'Mzuzu' } as never });
  });

  it('is not shown to officers', () => {
    useAppStore.setState({ user: { id: 'o1', role: 'extension_officer' } as never });
    const { container } = render(<PilotsSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('compares the groups and says plainly when it is too early', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve({ data: { data: url === '/pilots' ? [pilot] : {
      pilot,
      results: { service: arm({}), comparison: arm({ endlineKgPerHa: 1600, meanChangeKgPerHa: 100, followups: { asked: 0, yes: 0, partly: 0, no: 0 } }), difference: { kgPerHa: 200, low: 40, high: 360 }, tooEarly: true },
      minPerGroup: 30,
    } } }));
    render(<PilotsSection />);
    expect(await screen.findByText('Mzuzu, maize, 2026-11-01 to 2027-04-30.')).toBeInTheDocument();
    expect(screen.getByText('60% / 20% of 40')).toBeInTheDocument();
    expect(screen.getAllByText('75% of 120 (150)')).toHaveLength(2);
    expect(screen.getAllByText('210 / 40')).toHaveLength(2);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('changed by 200 kg/ha more than the comparison group’s (95% range 40 to 360)');
    expect(status).toHaveTextContent('Too early to draw a conclusion: each group needs at least 30 farmers');
  });

  it('asks every pilot farmer for last season’s harvest', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve({ data: { data: url === '/pilots' ? [pilot] : {
      pilot, results: { service: arm({}), comparison: arm({}), difference: null, tooEarly: true }, minPerGroup: 30,
    } } }));
    api.post.mockResolvedValue({ data: { data: { sent: 230, opted_out: 4, no_contact: 6, failed: 0 } } });
    render(<PilotsSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask for last season’s harvest' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pilots/p1/ask-harvest', { which: 'baseline' }));
  });
});
