import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueueStats } from '@/pages/agents/QueueStats';

describe('QueueStats', () => {
  it('derives the pass rate from the real counts', () => {
    render(<QueueStats status={{ queued: 2, active: 1, completed: 3, failed: 1 }} />);
    expect(screen.getByText('75% pass')).toBeInTheDocument();
    expect(screen.getByText('After all retries')).toBeInTheDocument();
  });

  it('makes no pass-rate claim before any task has run', () => {
    render(<QueueStats status={{ queued: 0, active: 0, completed: 0, failed: 0 }} />);
    expect(screen.getByText('no runs yet')).toBeInTheDocument();
    expect(screen.queryByText(/% pass/)).not.toBeInTheDocument();
  });
});
