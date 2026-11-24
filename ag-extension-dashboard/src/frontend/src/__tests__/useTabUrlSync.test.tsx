import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTabUrlSync } from '@/hooks/useTabUrlSync';

function setup(path: string, activeTab: string, signedIn = true) {
  const setActiveTab = vi.fn();
  const onUnknownPath = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );
  const view = renderHook(
    ({ tab }) => {
      useTabUrlSync({ activeTab: tab, setActiveTab, signedIn, onUnknownPath });
      return useLocation().pathname;
    },
    { wrapper, initialProps: { tab: activeTab } }
  );
  return { ...view, setActiveTab, onUnknownPath };
}

describe('useTabUrlSync', () => {
  it('opens the screen a deep link names', () => {
    const { setActiveTab, onUnknownPath } = setup('/fields', 'dashboard');
    expect(setActiveTab).toHaveBeenCalledWith('fields');
    expect(onUnknownPath).not.toHaveBeenCalled();
  });

  it('puts the chosen screen in the address bar', () => {
    const { rerender, result } = setup('/dashboard', 'dashboard');
    rerender({ tab: 'visits' });
    expect(result.current).toBe('/visits');
  });

  it('says so when no screen answers an address and goes back to the open screen', () => {
    const { result, onUnknownPath } = setup('/no-such-screen', 'fields');
    expect(onUnknownPath).toHaveBeenCalledWith('/no-such-screen');
    expect(result.current).toBe('/fields');
  });

  it('leaves the public pages and sign-in alone', () => {
    for (const path of ['/', '/login', '/demo/officer', '/reset-password']) {
      const { onUnknownPath, result } = setup(path, 'dashboard');
      expect(onUnknownPath).not.toHaveBeenCalled();
      expect(result.current).toBe(path);
    }
  });

  it('does nothing before anyone signs in', () => {
    const { onUnknownPath, setActiveTab } = setup('/no-such-screen', 'dashboard', false);
    expect(onUnknownPath).not.toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});
