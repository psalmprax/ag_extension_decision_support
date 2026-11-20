import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserAccessModal } from '@/components/users/UserAccessModal';
import type { DirectoryUser } from '@/components/users/types';

vi.mock('@/api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('@/api/billingService', () => ({
  fetchPlanQuotas: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? _key,
  }),
}));

const NOTE = 'Only a system administrator can change this account.';

const account = (overrides: Partial<DirectoryUser>): DirectoryUser => ({
  id: 'target-1',
  firstName: 'Amina',
  lastName: 'Otieno',
  email: 'amina@example.org',
  role: 'admin',
  region: 'Central',
  phone: '',
  isActive: true,
  ...overrides,
});

const renderModal = (user: DirectoryUser, actorIsSystemAdmin: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserAccessModal user={user} currentUserId="actor-1" actorIsSystemAdmin={actorIsSystemAdmin} isDemo={false} onClose={() => {}} />
    </QueryClientProvider>
  );

describe('UserAccessModal admin guard (matches the server rule)', () => {
  it('lets a system administrator edit another system administrator', () => {
    renderModal(account({ isSystemAdmin: true }), true);
    expect(screen.getByLabelText('System role')).not.toBeDisabled();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('lets a system administrator edit an ordinary admin', () => {
    renderModal(account({ isSystemAdmin: false }), true);
    expect(screen.getByLabelText('System role')).not.toBeDisabled();
  });

  it('locks a system administrator account for an ordinary admin', () => {
    renderModal(account({ isSystemAdmin: true }), false);
    expect(screen.getByLabelText('System role')).toBeDisabled();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('locks an admin account for an ordinary admin', () => {
    renderModal(account({ isSystemAdmin: false }), false);
    expect(screen.getByLabelText('System role')).toBeDisabled();
  });

  it('leaves non-admin accounts editable for an ordinary admin', () => {
    renderModal(account({ role: 'farmer' }), false);
    expect(screen.getByLabelText('System role')).not.toBeDisabled();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});
