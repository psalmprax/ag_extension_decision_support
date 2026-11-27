import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PossibleCause } from '../PossibleCause';
import { certaintyKey } from '@/hooks/useHowSure';

const base = {
  disease: 'Late Blight',
  confidence: 0.82,
  description: 'Late blight is a serious disease of tomatoes and potatoes.',
  safetyNotice: 'This is a starting point, not a diagnosis. Ask your extension officer to confirm it.',
};

describe('a possible cause, said the way an officer would', () => {
  it('turns confidence into words, with the rounded percentage beside them', () => {
    expect([0.9, 0.75, 0.6, 0.5, 0.49, 0.1].map(certaintyKey)).toEqual([
      'diag_sure_high', 'diag_sure_high', 'diag_sure_medium', 'diag_sure_medium', 'diag_sure_low', 'diag_sure_low',
    ]);
    render(<PossibleCause {...base} confirmedBySource={false} />);
    expect(screen.getByText('How sure: fairly sure (82%)')).toBeInTheDocument();
  });

  it('says "might be" until a checked source backs it, and "looks like" after', () => {
    const { rerender } = render(<PossibleCause {...base} confirmedBySource={false} />);
    expect(screen.getByRole('heading', { name: 'Might be Late Blight' })).toBeInTheDocument();
    expect(screen.getByText('Not checked by an expert yet')).toBeInTheDocument();
    rerender(<PossibleCause {...base} confirmedBySource />);
    expect(screen.getByRole('heading', { name: 'Looks like Late Blight' })).toBeInTheDocument();
    expect(screen.getByText('From a checked source')).toBeInTheDocument();
  });

  it('shows how serious only when the check judged that, and keeps the reminder to confirm', () => {
    const { rerender } = render(<PossibleCause {...base} confirmedBySource={false} />);
    expect(screen.queryByText(/How serious/)).not.toBeInTheDocument();
    rerender(<PossibleCause {...base} severity="severe" confirmedBySource={false} />);
    expect(screen.getByText('How serious: severe')).toBeInTheDocument();
    expect(screen.getByText(base.safetyNotice)).toBeInTheDocument();
  });

  it('offers more about the disease by name', () => {
    const onMore = vi.fn();
    render(<PossibleCause {...base} confirmedBySource={false} onMore={onMore} />);
    fireEvent.click(screen.getByRole('button', { name: 'More about Late Blight' }));
    expect(onMore).toHaveBeenCalled();
  });
});
