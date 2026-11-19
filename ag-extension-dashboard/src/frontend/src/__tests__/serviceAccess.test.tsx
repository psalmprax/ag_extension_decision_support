import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isMenuItemLocked, lacksPaidAccess } from '@/lib/planAccess';
import { ServiceAccessSection } from '@/components/users/ServiceAccessSection';
import { fetchServiceAccess, grantServiceAccess, revokeServiceAccess } from '@/api/serviceAccessService';

vi.mock('@/api/serviceAccessService', () => ({
  fetchServiceAccess: vi.fn(),
  grantServiceAccess: vi.fn(),
  revokeServiceAccess: vi.fn(),
}));

const freeFarmer = { role: 'farmer', isFree: true, planName: 'Free' };

describe('plan access with service grants', () => {
  it('keeps a Pro item locked on the Free plan unless its service was granted', () => {
    const chatItem = { requiresPro: true, service: 'chat' as const };
    expect(isMenuItemLocked(freeFarmer, chatItem)).toBe(true);
    expect(isMenuItemLocked({ ...freeFarmer, serviceAccess: ['chat'] }, chatItem)).toBe(false);
    // A grant of another service does not unlock it, nor does a grant for an item without a service.
    expect(isMenuItemLocked({ ...freeFarmer, serviceAccess: ['field_visits'] }, chatItem)).toBe(true);
    expect(isMenuItemLocked({ ...freeFarmer, serviceAccess: ['chat'] }, { requiresPro: true })).toBe(true);
    // Paid plans and admins are never locked.
    expect(isMenuItemLocked({ role: 'farmer', isFree: false, planName: 'Pro' }, chatItem)).toBe(false);
    expect(lacksPaidAccess({ role: 'admin' }, 'chat')).toBe(false);
  });
});

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ServiceAccessSection userId="farmer-1" />
    </QueryClientProvider>
  );
}

describe('ServiceAccessSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grants a service with the picked end date and then offers to revoke it', async () => {
    vi.mocked(fetchServiceAccess).mockResolvedValue({
      grantable: [{ service: 'chat', label: 'Farmer chat & AI assistant' }, { service: 'field_visits', label: 'Field Visits & Tracking' }],
      active: [],
    });
    vi.mocked(grantServiceAccess).mockResolvedValue([
      { service: 'chat', label: 'Farmer chat & AI assistant', grantedAt: '2026-11-19T10:00:00Z', expiresAt: '2026-12-31T22:59:59Z', grantedBy: 'Samuel', note: null },
    ]);
    renderSection();

    const section = await screen.findByRole('group', { name: 'Service access' });
    expect(within(section).getAllByText('Not granted')).toHaveLength(2);
    fireEvent.change(within(section).getByLabelText('New grants end on (optional)'), { target: { value: '2026-12-31' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Grant: Farmer chat & AI assistant' }));

    await waitFor(() => expect(grantServiceAccess).toHaveBeenCalledWith('farmer-1', 'chat', new Date('2026-12-31T23:59:59').toISOString()));
    expect(await within(section).findByRole('button', { name: 'Revoke: Farmer chat & AI assistant' })).toBeInTheDocument();
    expect(within(section).getByText(/Granted until/)).toBeInTheDocument();
  });

  it('revokes, and shows why when the server refuses', async () => {
    vi.mocked(fetchServiceAccess).mockResolvedValue({
      grantable: [{ service: 'chat', label: 'Farmer chat & AI assistant' }],
      active: [{ service: 'chat', label: 'Farmer chat & AI assistant', grantedAt: '2026-11-19T10:00:00Z', expiresAt: null, grantedBy: null, note: null }],
    });
    vi.mocked(revokeServiceAccess).mockRejectedValue({ response: { data: { error: 'System administrator privileges required' } } });
    renderSection();

    expect(await screen.findByText('Granted, no end date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke: Farmer chat & AI assistant' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('System administrator privileges required'));
    expect(revokeServiceAccess).toHaveBeenCalledWith('farmer-1', 'chat');
  });
});
