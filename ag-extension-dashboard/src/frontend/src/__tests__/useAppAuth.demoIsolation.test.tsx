import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUserProfile } from '@/api/authService';
import { useAppAuth } from '@/hooks/useAppAuth';

vi.mock('@/api/authService', () => ({ fetchUserProfile: vi.fn() }));
vi.mock('@/api/client', () => ({ getCsrfToken: () => 'session-csrf' }));

const admin = {
  id: 'real-admin', email: 'admin@example.test', firstName: 'Real', lastName: 'Admin',
  role: 'admin' as const, isDemo: false,
};

describe('Verified demo identity synchronization', () => {
  beforeEach(() => {
    vi.mocked(fetchUserProfile).mockReset();
    vi.mocked(fetchUserProfile).mockResolvedValue({ success: true, data: admin });
  });

  it('replaces a stale demo identity with the verified real account profile', async () => {
    const setUser = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const staleDemo = { ...admin, id: 'demo-user', email: 'demo@agridemo.com', isDemo: true };
    const { result } = renderHook(() => useAppAuth(staleDemo, setUser), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(admin));
    expect(result.current.user?.isDemo).toBe(false);
  });

  it('does not reuse a previous account’s profile cache', async () => {
    const setUser = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['user-profile', 'demo-user'], {
      success: true, data: { ...admin, id: 'demo-user', email: 'demo@agridemo.com', isDemo: true },
    });
    renderHook(() => useAppAuth(admin, setUser), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(admin));
    expect(fetchUserProfile).toHaveBeenCalledTimes(1);
  });
});
