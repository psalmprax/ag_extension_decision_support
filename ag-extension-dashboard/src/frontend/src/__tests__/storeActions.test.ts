import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/farmerService', () => ({
  updateFarmer: vi.fn().mockResolvedValue({ success: true }),
  updateFarmers: vi.fn().mockResolvedValue({ success: true }),
  removeFarmer: vi.fn().mockResolvedValue({ success: true }),
  removeFarmers: vi.fn().mockResolvedValue({ success: true }),
  deleteFarmer: vi.fn().mockResolvedValue({ success: true }),
  deleteFarmers: vi.fn().mockResolvedValue({ success: true }),
  fetchFarmers: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('@/api/visitService', () => ({
  addVisit: vi.fn().mockResolvedValue({ success: true }),
  updateVisit: vi.fn().mockResolvedValue({ success: true }),
  fetchVisits: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createVisit: vi.fn().mockResolvedValue({ success: true, data: { id: '1', status: 'pending' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAppStore } from '@/store/useAppStore';

describe('useAppStore - additional actions', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getState(), true);
    localStorage.clear();
  });

  it('should set context menu', () => {
    const { showContextMenu, hideContextMenu } = useAppStore.getState();

    showContextMenu({ x: 100, y: 200, entityType: 'farmer', entityId: '1' });
    expect(useAppStore.getState().contextMenu).toEqual({
      x: 100,
      y: 200,
      entityType: 'farmer',
      entityId: '1',
    });

    hideContextMenu();
    expect(useAppStore.getState().contextMenu).toBeNull();
  });

  it('should set share modal', () => {
    const { showShareModal, hideShareModal } = useAppStore.getState();

    showShareModal({ entityType: 'farmer', entityId: '1', entityName: 'Test Farmer' });
    expect(useAppStore.getState().shareModal).toEqual({
      entityType: 'farmer',
      entityId: '1',
      entityName: 'Test Farmer',
    });

    hideShareModal();
    expect(useAppStore.getState().shareModal).toBeNull();
  });

  it('should set user', () => {
    const { setUser } = useAppStore.getState();
    const user = {
      id: '1',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin' as const,
    };

    setUser(user);
    expect(useAppStore.getState().user).toEqual(user);
  });

  it('should set loading state', () => {
    const { setLoading } = useAppStore.getState();

    setLoading(true);
    expect(useAppStore.getState().isLoading).toBe(true);

    setLoading(false);
    expect(useAppStore.getState().isLoading).toBe(false);
  });

  it('should set dark mode', () => {
    const { toggleDarkMode } = useAppStore.getState();

    toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(true);

    toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(false);
  });

  it('should manage notifications', () => {
    const { addNotification, clearNotifications } = useAppStore.getState();

    addNotification({ type: 'info', message: 'Test' });
    expect(useAppStore.getState().notifications.length).toBe(1);

    clearNotifications();
    expect(useAppStore.getState().notifications.length).toBe(0);
  });
});
