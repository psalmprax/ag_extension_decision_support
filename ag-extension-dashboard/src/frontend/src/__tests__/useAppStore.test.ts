import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';

describe('useAppStore', () => {
    beforeEach(() => {
        // Reset the store before each test
        const initialState = useAppStore.getState();
        useAppStore.setState(initialState, true);
        localStorage.clear();
    });

    it('should have initial state', () => {
        const state = useAppStore.getState();
        expect(state.sidebarOpen).toBe(true);
        expect(state.darkMode).toBe(false);
        expect(state.activeTab).toBe('dashboard');
        expect(state.user).not.toBeNull();
        expect(state.farmers.length).toBeGreaterThan(0);
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

    it('should manage farmers', () => {
        const { addFarmer, removeFarmer, updateFarmer } = useAppStore.getState();
        const initialCount = useAppStore.getState().farmers.length;
        
        const newFarmer = {
            id: '99',
            name: 'Test Farmer',
            location: 'Test Location',
            phone: '123456789'
        };

        addFarmer(newFarmer);
        expect(useAppStore.getState().farmers.length).toBe(initialCount + 1);
        expect(useAppStore.getState().farmers).toContainEqual(newFarmer);

        updateFarmer('99', { name: 'Updated Name' });
        const updatedFarmer = useAppStore.getState().farmers.find(f => f.id === '99');
        expect(updatedFarmer?.name).toBe('Updated Name');

        removeFarmer('99');
        expect(useAppStore.getState().farmers.length).toBe(initialCount);
    });

    it('should manage notifications', () => {
        const { addNotification, clearNotifications } = useAppStore.getState();
        
        addNotification({
            type: 'info',
            message: 'Test Notification'
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
