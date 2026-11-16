import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoleTabGuard } from '@/hooks/useRoleTabGuard';

describe('useRoleTabGuard', () => {
  it('moves a farmer off the officer dashboard onto their own', () => {
    const setActiveTab = vi.fn();
    renderHook(() => useRoleTabGuard('dashboard', setActiveTab, ['farmer_dashboard', 'aiassistant', 'knowledge'], true));
    expect(setActiveTab).toHaveBeenCalledWith('farmer_dashboard');
  });

  it('leaves a tab the role can open alone', () => {
    const setActiveTab = vi.fn();
    renderHook(() => useRoleTabGuard('knowledge', setActiveTab, ['farmer_dashboard', 'knowledge'], true));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('keeps in-page flows that have no menu entry', () => {
    const setActiveTab = vi.fn();
    renderHook(() => useRoleTabGuard('register_farmer', setActiveTab, ['dashboard', 'portfolio'], true));
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('does nothing before sign-in or while the menu is empty', () => {
    const setActiveTab = vi.fn();
    renderHook(() => useRoleTabGuard('dashboard', setActiveTab, ['farmer_dashboard'], false));
    renderHook(() => useRoleTabGuard('dashboard', setActiveTab, [], true));
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});
