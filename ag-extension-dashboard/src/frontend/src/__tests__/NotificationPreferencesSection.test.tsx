import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useAppStore } from '@/store/useAppStore';

vi.mock('@/api/client', () => ({ default: { patch: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// No translations loaded: labels fall back to their English text.
vi.mock('@/lib/LanguageContext', () => ({ useLanguage: () => ({ t: () => '' }) }));

const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>;

function Harness() {
  return <NotificationPreferencesSection {...useNotificationPreferences()} />;
}

describe('Settings alert preferences', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    useAppStore.setState({
      user: { id: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.c', role: 'extension_officer', notificationPreferences: { smsAlerts: false } },
    });
  });

  it('shows the choices saved on the account (missing means on)', () => {
    render(<Harness />);
    expect(screen.getByRole('switch', { name: 'SMS alerts' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Email alerts' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/Sound/)).not.toBeInTheDocument();
  });

  it('saves one channel to the account and keeps the server\'s answer', async () => {
    mockPatch.mockResolvedValue({ data: { success: true, data: { notificationPreferences: { smsAlerts: false, emailAlerts: false } } } });
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Email alerts' }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/auth/me', { notificationPreferences: { emailAlerts: false } }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Email alerts' })).toHaveAttribute('aria-checked', 'false'));
    expect(useAppStore.getState().user?.notificationPreferences).toEqual({ emailAlerts: false, smsAlerts: false, pushNotifications: true });
    expect(toast.success).toHaveBeenCalledWith('Alert settings saved');
  });

  it('puts the switch back and says so when saving fails', async () => {
    mockPatch.mockRejectedValue(new Error('offline'));
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Push notifications' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not save your alert settings. Nothing was changed.'));
    expect(screen.getByRole('switch', { name: 'Push notifications' })).toHaveAttribute('aria-checked', 'true');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
