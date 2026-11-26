import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileMenu } from '../ProfileMenu';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<HTMLDivElement, Record<string, unknown>>(({ variants: _v, initial: _i, animate: _a, exit: _e, ...props }, ref) => (
      <div ref={ref} {...props} />
    )),
  },
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

  it('the account menu works from the keyboard: first item focused, arrows move, Escape goes back', () => {
    let open = true;
    const setOpen = vi.fn((next: boolean) => {
      open = next;
    });
    render(
      <ProfileMenu
        isProfileMenuOpen={open}
        setIsProfileMenuOpen={setOpen}
        storeUser={{ id: 'u1', firstName: 'Demo', lastName: 'User', email: 'demo@example.test' }}
        setShowProfileModal={vi.fn()}
        handleLogout={vi.fn()}
      />
    );
    const [profile, signOut] = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(profile);

    fireEvent.keyDown(profile, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(signOut, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(profile);
    fireEvent.keyDown(profile, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(signOut);

    fireEvent.keyDown(signOut, { key: 'Escape' });
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /profile menu/i }));
  });

  it('the theme picker is plain buttons on a solid surface, and closes with Escape', () => {
    render(<ThemeSwitcher currentTheme="forest" onThemeChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger.getAttribute('aria-haspopup')).toBeNull();
    expect(trigger.className).not.toMatch(ONE_THEME_TEXT);

    fireEvent.click(trigger);
    const choices = screen.getByRole('group');
    expect(screen.queryByRole('listbox')).toBeNull();
    const current = screen.getByRole('button', { name: 'Forest green', pressed: true });
    expect(choices.contains(current)).toBe(true);
    expectSolidAndReadable(choices.parentElement as HTMLElement);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group')).toBeNull();
  });
});
