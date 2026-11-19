import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FarmerChatMessage } from '@/components/chat/FarmerChatMessage';
import { VisitLocationBadge } from '@/components/visits/VisitLocationBadge';
import { rememberCopilotDraft, takeCopilotDraft } from '@/lib/copilotDraft';
import type { ChatMessage } from '@/types/dashboard';

const aiAnswer = (metadata: ChatMessage['metadata']): ChatMessage => ({
  role: 'assistant',
  content: 'Top-dress with nitrogen once the rains settle [1].',
  createdAt: '2026-11-19T09:00:00Z',
  metadata,
});

describe('AI answers show what they rest on', () => {
  it('lists numbered sources, linked when there is a URL', () => {
    render(
      <FarmerChatMessage
        viewer="farmer"
        message={aiAnswer({ evidence: 'sourced', sources: [{ n: 1, title: 'KALRO maize guide', url: 'https://www.kalro.org/maize' }, { n: 2, title: 'Ministry pest manual', url: null }] })}
      />
    );
    const list = screen.getByRole('list', { name: 'Sources' });
    expect(list).toHaveTextContent('[1]KALRO maize guide');
    expect(screen.getByRole('link', { name: 'KALRO maize guide' })).toHaveAttribute('href', 'https://www.kalro.org/maize');
    expect(screen.getByText('Ministry pest manual').tagName).toBe('SPAN');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('tells the farmer to check unsourced advice with their officer, and the officer that it is queued', () => {
    const general = aiAnswer({ evidence: 'general', sources: [], review: 'no_sources' });
    const { unmount } = render(<FarmerChatMessage viewer="farmer" message={general} />);
    expect(screen.getByRole('note')).toHaveTextContent('Check with your officer before you act on it.');
    unmount();
    render(<FarmerChatMessage viewer="officer" message={general} />);
    expect(screen.getByRole('note')).toHaveTextContent('Queued for agronomist review.');
  });

  it("labels an officer's reply that began as an AI draft", () => {
    const reply: ChatMessage = { role: 'officer', content: 'When did it start?', metadata: { aiDraft: { edited: true } } };
    const { unmount } = render(<FarmerChatMessage viewer="farmer" message={reply} />);
    expect(screen.getByText('Drafted with AI and checked by your officer')).toBeInTheDocument();
    unmount();
    render(<FarmerChatMessage viewer="officer" message={reply} />);
    expect(screen.getByText('From an AI draft, edited before sending')).toBeInTheDocument();
  });

  it('keeps a used copilot draft only until the reply is sent', () => {
    rememberCopilotDraft('thread-1', 'Draft text');
    expect(takeCopilotDraft('thread-2')).toBeUndefined();
    expect(takeCopilotDraft('thread-1')).toBe('Draft text');
    expect(takeCopilotDraft('thread-1')).toBeUndefined();
  });
});

describe('VisitLocationBadge', () => {
  it('confirms a visit on the farm with its distance', () => {
    render(<VisitLocationBadge check={{ status: 'on_farm', distanceM: 96, accuracyM: 12 }} />);
    expect(screen.getByTestId('visit-location')).toHaveTextContent('Verified on the farm (96 m)');
  });

  it('says how far away a report was filed, in km past 1,000 m', () => {
    render(<VisitLocationBadge check={{ status: 'away', distanceM: 2240, accuracyM: 10 }} />);
    expect(screen.getByTestId('visit-location')).toHaveTextContent('Filed 2.2 km from the farm');
  });

  it('explains when a visit could not be confirmed, and shows nothing before completion', () => {
    const { rerender, container } = render(<VisitLocationBadge check={{ status: 'not_shared', distanceM: null, accuracyM: null }} />);
    expect(screen.getByTestId('visit-location')).toHaveTextContent('Location not shared with this report');
    rerender(<VisitLocationBadge check={{ status: 'farm_location_unknown', distanceM: null, accuracyM: 8 }} />);
    expect(screen.getByTestId('visit-location')).toHaveTextContent('Farm location not set');
    rerender(<VisitLocationBadge check={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
