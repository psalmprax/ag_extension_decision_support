import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/api/billingService', () => ({
  fetchChurnAnalytics: vi.fn(),
}));

import { fetchChurnAnalytics } from '@/api/billingService';
import { ChurnReasons } from '@/components/billing/ChurnReasons';

const mockFetch = vi.mocked(fetchChurnAnalytics);

describe('ChurnReasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each reason with its share and the coverage note', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        predictedChurnRate: 10,
        atRiskCustomers: 0,
        churnReasons: [
          { reason: 'too_expensive', count: 3, percentage: 60 },
          { reason: 'missing_features', count: 2, percentage: 40 },
        ],
        churnReasonCoverage: { recorded: 5, cancellationsLast30Days: 8 },
      },
    });

    render(<ChurnReasons />);

    await waitFor(() => expect(screen.getByText('Too expensive')).toBeInTheDocument());
    expect(screen.getByText('Missing features')).toBeInTheDocument();
    expect(screen.getByText('3 · 60.0%')).toBeInTheDocument();
    expect(
      screen.getByText(/Based on 5 recorded reasons out of 8 cancellations in the last 30 days/)
    ).toBeInTheDocument();
  });

  it('explains the empty state instead of implying zero churn', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        predictedChurnRate: 0,
        atRiskCustomers: 0,
        churnReasons: [],
        churnReasonCoverage: { recorded: 0, cancellationsLast30Days: 4 },
      },
    });

    render(<ChurnReasons />);

    await waitFor(() =>
      expect(screen.getByText(/No cancellation reasons have been recorded in this period/)).toBeInTheDocument()
    );
    expect(screen.getByText(/out of 4 cancellations/)).toBeInTheDocument();
  });

  it('shows the server error rather than a blank panel', async () => {
    mockFetch.mockResolvedValue({ success: false, error: 'Admin only' });

    render(<ChurnReasons />);

    await waitFor(() => expect(screen.getByText('Admin only')).toBeInTheDocument());
  });
});
