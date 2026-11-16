import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffBadges } from '@/components/users/StaffBadges';

describe('StaffBadges', () => {
  it('marks demo-session accounts', () => {
    render(<StaffBadges roleLabel="Extension officer" roleClass="" isDemo />);
    expect(screen.getByText('Extension officer')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toHaveAttribute('title', expect.stringContaining('Shared demo login'));
  });

  it('shows no demo badge for real accounts', () => {
    render(<StaffBadges roleLabel="Admin" roleClass="" />);
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
  });
});
