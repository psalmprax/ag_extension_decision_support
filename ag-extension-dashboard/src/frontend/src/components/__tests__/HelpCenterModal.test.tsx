import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSupportTicket } from '@/api/supportService';
import { HelpCenterModal } from '../HelpCenterModal';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: { setActiveTab: () => void; addNotification: () => void }) => unknown) =>
    selector({ setActiveTab: vi.fn(), addNotification: vi.fn() }),
}));

vi.mock('@/api/supportService', () => ({
  fetchFAQs: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createSupportTicket: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

describe('HelpCenterModal', () => {
  it('resets the category when opening a generic support ticket', () => {
    render(<HelpCenterModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Feature Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close support ticket form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }));

    expect(screen.getByRole('combobox')).toHaveValue('general');
  });

  it('submits feature requests using the dedicated category', async () => {
    render(<HelpCenterModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Feature Request' }));

    const category = screen.getByRole('combobox');
    expect(category).toHaveValue('feature-request');
    expect(screen.getByRole('option', { name: 'Feature Request' })).toHaveValue('feature-request');

    fireEvent.change(screen.getByPlaceholderText('Brief description of your issue'), {
      target: { value: 'Add crop planning' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe your issue in detail...'), {
      target: { value: 'Support seasonal crop planning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }));

    await waitFor(() => {
      expect(createSupportTicket).toHaveBeenCalledWith({
        subject: 'Add crop planning',
        category: 'feature-request',
        description: 'Support seasonal crop planning.',
      });
    });
  });

  it('does not report success when support ticket submission fails', async () => {
    vi.mocked(createSupportTicket).mockRejectedValueOnce(new Error('network unavailable'));
    render(<HelpCenterModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Report an Issue' }));
    fireEvent.change(screen.getByPlaceholderText('Brief description of your issue'), {
      target: { value: 'Map is not loading' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe your issue in detail...'), {
      target: { value: 'The map stays blank after signing in.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }));

    await waitFor(() => expect(createSupportTicket).toHaveBeenCalled());
    expect(screen.queryByText('Ticket Submitted')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Ticket' })).toBeInTheDocument();
  });
});
