import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  createSupportTicket: vi.fn(),
}));

describe('HelpCenterModal', () => {
  it('selects the feature-request category from the Feature Request action', () => {
    render(<HelpCenterModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Feature Request' }));

    expect(screen.getByRole('combobox')).toHaveValue('feature-request');
  });
});
