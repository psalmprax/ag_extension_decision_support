import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileMenu } from '../ProfileMenu';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ variants: _v, initial: _i, animate: _a, exit: _e, ...props }: Record<string, unknown>) => <div {...props} /> },
}));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : options?.defaultValue ?? key,
  }),
}));

/** Classes that leave a floating menu see-through, or its text unreadable in one theme. */
const SEE_THROUGH = /\bglass-panel\b|dark:bg-white\/|bg-white\/\d|bg-black\/\d/;
const ONE_THEME_TEXT = /(^|\s)text-(white|slate-300)(\s|$)/;

function expectSolidAndReadable(panel: HTMLElement) {
  expect(panel.className).toContain('popover-surface');
  for (const el of [panel, ...Array.from(panel.querySelectorAll<HTMLElement>('*'))]) {
    expect(el.getAttribute('class') ?? '').not.toMatch(SEE_THROUGH);
    expect(el.getAttribute('class') ?? '').not.toMatch(ONE_THEME_TEXT);
  }
}

describe('floating menus are solid and readable in both themes', () => {
  it('the account menu is a real menu on a solid surface', () => {
    const setOpen = vi.fn();
    render(
      <ProfileMenu
        isProfileMenuOpen
        setIsProfileMenuOpen={setOpen}
        storeUser={{ id: 'u1', firstName: 'Demo', lastName: 'User', email: 'demo@example.test' }}
        setShowProfileModal={vi.fn()}
        handleLogout={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /profile menu/i }).getAttribute('aria-haspopup')).toBe('menu');
    const menu = screen.getByRole('menu', { name: 'Account info' });
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Profile', 'Sign out']);
    expectSolidAndReadable(menu);
  });

  it('the theme picker is a list on a solid surface that closes with Escape', () => {
    render(<ThemeSwitcher currentTheme={'emerald' as never} onThemeChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.className).not.toMatch(ONE_THEME_TEXT);

    fireEvent.click(trigger);
    const list = screen.getByRole('listbox');
    expectSolidAndReadable(list.parentElement as HTMLElement);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
