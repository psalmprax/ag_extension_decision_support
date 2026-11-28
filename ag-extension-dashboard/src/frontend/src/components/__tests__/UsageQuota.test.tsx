import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UsageQuota } from '../UsageQuota';

vi.mock('@/api/billingService', () => ({
  fetchUsage: vi.fn().mockResolvedValue({
    data: {
      plan: { name: 'Pro' },
      usage: [
        { type: 'sms', label: 'SMS messages', current: 12, limit: 500 },
        { type: 'ai_vision', label: 'Photo checks', current: 0, limit: 0 },
        { type: 'knowledge', label: 'Knowledge searches today', current: 0, limit: -1 },
      ],
    },
  }),
}));
vi.mock('@/hooks/useAppAuth', () => ({ hasAuthSession: () => true }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : options?.defaultValue ?? key,
  }),
}));

describe('usage panel', () => {
  it('says "Not included" for a quota of 0, never "NaN%", and labels in sentence case', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UsageQuota />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Photo checks')).toBeInTheDocument();
    expect(screen.getByText('Not included')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
