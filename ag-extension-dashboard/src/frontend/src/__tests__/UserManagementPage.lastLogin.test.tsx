import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { UserManagementPage } from '@/pages/UserManagementPage';

vi.mock('@/api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/api/authService', () => ({ fetchLoginHistory: vi.fn().mockResolvedValue([]), fetchLoginStats: vi.fn().mockResolvedValue(null) }));
vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: false }), DEMO_USERS: [] }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: (_key: string, fallback?: string, vars?: Record<string, string>) =>
      (fallback || '').replace(/\{(\w+)\}/g, (_m, k) => vars?.[k] ?? ''),
  }),
}));

describe('Staff & officers', () => {
  it('shows the last sign-in the API reports (lastLogin), not "No recent login"', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: [
          { id: 'u1', firstName: 'Amina', lastName: 'Otieno', email: 'amina@example.org', role: 'extension_officer', region: 'Machakos', phone: '', lastLogin: '2026-11-16T07:30:00.000Z' },
          { id: 'u2', firstName: 'Never', lastName: 'Signed', email: 'never@example.org', role: 'extension_officer', region: 'Machakos', phone: '', lastLogin: null },
        ],
      },
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UserManagementPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText(`Last: ${new Date('2026-11-16T07:30:00.000Z').toLocaleDateString()}`)).toBeInTheDocument();
    expect(screen.getAllByText('No recent login')).toHaveLength(1);
  });
});
