import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/api/client';
import { AdminDemoRecords } from '@/components/AdminDemoRecords';
import { useAppStore } from '@/store/useAppStore';
import translations from '../../public/locales/en.json';

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: keyof typeof translations) => translations[key] }),
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminDemoRecords /></QueryClientProvider>);
}

describe('AdminDemoRecords', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    useAppStore.setState({
      user: {
        id: 'admin-1', email: 'admin@example.test', firstName: 'Admin', lastName: 'User', role: 'admin',
      },
      isDemo: false,
    });
    vi.mocked(apiClient.get).mockImplementation(async url => ({
      data: { success: true, data: url === '/users'
        ? [{ id: 'demo-user', firstName: 'Sample', lastName: 'Officer', email: 'demo@example.test' }]
        : { farmers: [{ id: 'demo-farmer', firstName: 'Sample', lastName: 'Farmer', region: 'Central' }], total: 1 } },
    }));
  });

  it('does not fetch or show demo records until the admin opts in', () => {
    renderPanel();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: translations.users_demo_title })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Sample Farmer')).not.toBeInTheDocument();
  });

  it('loads explicitly scoped demo users and farmers in a labeled read-only panel', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: translations.users_demo_title }));
    expect(await screen.findByText('Sample Farmer')).toBeInTheDocument();
    expect(screen.getByText('Sample Officer')).toBeInTheDocument();
    expect(screen.getByText(translations.users_demo_notice)).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/users', { params: { dataset: 'demo' } });
    expect(apiClient.get).toHaveBeenCalledWith('/farmers', { params: { dataset: 'demo', limit: 50, offset: 0 } });
    expect(screen.queryByRole('button', { name: /create|send|export|edit|delete/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: translations.users_demo_title }));
    expect(screen.queryByText('Sample Farmer')).not.toBeInTheDocument();
  });

  it.each(['regional_manager', 'extension_officer', 'farmer'] as const)('is unavailable to %s', role => {
    useAppStore.setState(state => ({ user: state.user ? { ...state.user, role } : null }));
    renderPanel();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('does not fetch database demo records in client demo mode', () => {
    useAppStore.setState(state => ({
      isDemo: true, user: state.user ? { ...state.user, isDemo: true } : null,
    }));
    renderPanel();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('reports load failures and allows retry without substituting sample data', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Unavailable'));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: translations.users_demo_title }));
    expect(await screen.findByRole('alert')).toHaveTextContent(translations.users_demo_load_error);
    fireEvent.click(screen.getByRole('button', { name: translations.users_demo_retry }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(4));
  });

  it('paginates demo farmers without querying the normal farmer cache', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url, config) => ({
      data: { success: true, data: url === '/users' ? [] : {
        farmers: config?.params.offset === 0
          ? Array.from({ length: 50 }, (_, index) => ({ id: `demo-${index}`, firstName: `Sample ${index}`, lastName: 'Farmer' }))
          : [], total: 50,
      } },
    }));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: translations.users_demo_title }));
    await screen.findByText('Sample 0 Farmer');
    fireEvent.click(screen.getByRole('button', { name: translations.users_demo_next }));
    await screen.findByText(translations.users_demo_empty_farmers);
    expect(apiClient.get).toHaveBeenCalledWith('/farmers', { params: { dataset: 'demo', limit: 50, offset: 50 } });
    expect(screen.getByRole('button', { name: translations.users_demo_previous })).toBeEnabled();
  });
});
