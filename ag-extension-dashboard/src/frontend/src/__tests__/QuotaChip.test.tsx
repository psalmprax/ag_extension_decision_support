import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuotaChip } from '../components/KnowledgeBase/QuotaChip';
import type { KnowledgeQuotaData } from '@/api/knowledgeService';

describe('QuotaChip', () => {
  it('renders Unlimited when quota.limit is -1', () => {
    const quota: KnowledgeQuotaData = {
      allowed: true,
      current: 0,
      limit: -1,
      remaining: 999999,
      isFree: false,
    };
    render(<QuotaChip quota={quota} onUpgrade={() => {}} />);
    expect(screen.getByText('DAILY QUOTA:')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
  });

  it('renders 3/3 searches for free/demo user with full quota', () => {
    const quota: KnowledgeQuotaData = {
      allowed: true,
      current: 0,
      limit: 3,
      remaining: 3,
      isFree: true,
    };
    render(<QuotaChip quota={quota} onUpgrade={() => {}} />);
    expect(screen.getByText('DAILY QUOTA:')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
  });

  it('renders remaining/limit and Upgrade button when free user remaining <= 1', () => {
    const onUpgrade = vi.fn();
    const quota: KnowledgeQuotaData = {
      allowed: true,
      current: 2,
      limit: 3,
      remaining: 1,
      isFree: true,
    };
    render(<QuotaChip quota={quota} onUpgrade={onUpgrade} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    const upgradeBtn = screen.getByText('Upgrade');
    expect(upgradeBtn).toBeInTheDocument();
    fireEvent.click(upgradeBtn);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('renders 0/3 when daily free limit is reached', () => {
    const quota: KnowledgeQuotaData = {
      allowed: false,
      current: 3,
      limit: 3,
      remaining: 0,
      isFree: true,
    };
    render(<QuotaChip quota={quota} onUpgrade={() => {}} />);
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });
});
