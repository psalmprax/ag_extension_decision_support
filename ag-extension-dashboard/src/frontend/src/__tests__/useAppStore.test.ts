import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock API services BEFORE importing the store so the hoisted vi.mock applies first
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
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAppStore } from '../store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Clear persisted state first, then reset store
    localStorage.clear();
    useAppStore.setState({
      user: null,
      sidebarOpen: true,
      darkMode: false,
      activeTab: 'dashboard',
      farmers: [],
      visits: [],
      notifications: [],
      isLoading: false,
    });
  });

  it('should have initial state', () => {
    const state = useAppStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.darkMode).toBe(false);
    expect(state.activeTab).toBe('dashboard');
    expect(state.user).toBeNull();
    expect(state.farmers).toEqual([]);
  });

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useAppStore.getState();

    toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(false);

    toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('should set active tab', () => {
    const { setActiveTab } = useAppStore.getState();

    setActiveTab('farmers');
    expect(useAppStore.getState().activeTab).toBe('farmers');
  });

  it('should manage farmers', { timeout: 10000 }, async () => {
    const { addFarmer, removeFarmer, updateFarmer } = useAppStore.getState();
    const initialCount = useAppStore.getState().farmers.length;

    const newFarmer = {
      id: '99',
      firstName: 'Test',
      lastName: 'Farmer',
      location: 'Test Location',
      phone: '123456789',
    };

    addFarmer(newFarmer);
    expect(useAppStore.getState().farmers.length).toBe(initialCount + 1);
    expect(useAppStore.getState().farmers).toContainEqual(newFarmer);

    await updateFarmer('99', { firstName: 'Updated' });
    const updatedFarmer = useAppStore.getState().farmers.find(f => f.id === '99');
    expect(updatedFarmer?.firstName).toBe('Updated');

    await removeFarmer('99');
    expect(useAppStore.getState().farmers.length).toBe(initialCount);
  });

  it('should manage notifications', () => {
    const { addNotification, clearNotifications } = useAppStore.getState();

    addNotification({
      type: 'info',
      message: 'Test Notification',
    });

    const state = useAppStore.getState();
    expect(state.notifications.length).toBe(1);
    expect(state.notifications[0].message).toBe('Test Notification');
    expect(state.notifications[0].read).toBe(false);
    expect(state.notifications[0].id).toBeDefined();

    clearNotifications();
    expect(useAppStore.getState().notifications.length).toBe(0);
  });

  it('should toggle dark mode and save to localStorage', () => {
    const { toggleDarkMode } = useAppStore.getState();

    toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
