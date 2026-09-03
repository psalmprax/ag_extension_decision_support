import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

describe('ProvenanceBadge', () => {
  it('renders nothing when provenance is missing', () => {
    const { container } = render(<ProvenanceBadge provenance={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip with the label for each kind', () => {
    const kinds = [
      { kind: 'computed_from_supplied_inputs' as const, label: 'From your inputs' },
      { kind: 'deterministic_estimation' as const, label: 'Estimated' },
      { kind: 'demo_reference_data' as const, label: 'Demo data' },
      { kind: 'unavailable' as const, label: 'No data' },
    ];
    for (const { kind, label } of kinds) {
      const view = render(
        <ProvenanceBadge provenance={{ kind, assumptions: [], demoData: false, note: 'note' }} />
      );
      expect(view.getByTestId('provenance-badge')).toHaveTextContent(label);
      view.unmount();
    }
  });

  it('full variant shows the note and assumptions', () => {
    render(
      <ProvenanceBadge
        variant="full"
        provenance={{
          kind: 'demo_reference_data',
          assumptions: ['Demo directory holds 2 Nakuru assets'],
          demoData: true,
          note: 'Equipment records come from an in-code demo directory.',
        }}
      />
    );
    const panel = screen.getByTestId('provenance-panel');
    expect(panel).toHaveTextContent('Demo data');
    expect(panel).toHaveTextContent('Equipment records come from an in-code demo directory.');
    expect(panel).toHaveTextContent('Demo directory holds 2 Nakuru assets');
  });
});
