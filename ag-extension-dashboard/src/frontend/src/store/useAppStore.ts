import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeName } from '@/theme';
import * as farmerService from '@/api/farmerService';
import * as visitService from '@/api/visitService';
import { toast } from 'react-hot-toast';

// Types
export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'admin' | 'extension_officer' | 'farmer';
    region?: string;
}

export interface Farmer {
    id: string;
    firstName: string;
    lastName: string;
    location: string;
    village?: string;
    phone: string;
    languagePreference?: string;
    crops?: string[];
    farmSize?: number;
    latitude?: number;
    longitude?: number;
    region?: string;
}

export interface Visit {
    id: string;
    farmerId: string;
    farmerName: string;
    scheduledDate: string;
    status: 'pending' | 'completed' | 'cancelled';
    notes?: string;
}

export interface Notification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    timestamp: number;
    read: boolean;
    actionLabel?: string;
    onAction?: () => void;
}

// App Store
export interface AppState {
    // User
    user: User | null;
    setUser: (user: User | null) => void;

    // Sidebar
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;

    // Theme
    themeName: ThemeName;
    setThemeName: (name: ThemeName) => void;

    // Dark mode
    darkMode: boolean;
    setDarkMode: (enabled: boolean) => void;
    toggleDarkMode: () => void;

    // Navigation
    activeTab: string;
    setActiveTab: (tab: string) => void;

    // Farmers
    farmers: Farmer[];
    setFarmers: (farmers: Farmer[]) => void;
    addFarmer: (farmer: Farmer) => void;
    updateFarmer: (id: string, updates: Partial<Farmer>) => Promise<void>;
    updateFarmers: (ids: string[], updates: Partial<Farmer>) => Promise<void>;
    removeFarmer: (id: string) => Promise<void>;
    removeFarmers: (ids: string[]) => Promise<void>;

    // Visits
    visits: Visit[];
    setVisits: (visits: Visit[]) => void;
    addVisit: (visit: Partial<Visit>) => Promise<void>;
    updateVisit: (id: string, updates: Partial<Visit>) => Promise<void>;

    // Notifications
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markNotificationRead: (id: string) => void;
    clearNotifications: () => void;

    // Loading states (counter-based to handle concurrent mutations)
    isLoading: boolean;
    _activeOperations: number;
    _startOperation: () => void;
    _endOperation: () => void;
    setLoading: (loading: boolean) => void;

    // Subscription & Usage
    subscription: {
        plan: {
            name: string;
            status: string;
        };
        usage: {
            type: string;
            current: number;
            limit: number;
            label: string;
        }[];
        periodEnd: string;
    } | null;
    setSubscription: (subscription: AppState['subscription']) => void;
    
    // Cross-route data
    pendingSMS: { phone: string; name: string } | null;
    setPendingSMS: (data: { phone: string; name: string } | null) => void;

    // UI Elements
    contextMenu: { x: number; y: number; entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user' | 'stat'; entityId?: string; isBulk?: boolean } | null;
    showContextMenu: (data: AppState['contextMenu']) => void;
    hideContextMenu: () => void;

    shareModal: { entityType: string; entityId: string; entityName?: string } | null;
    showShareModal: (data: AppState['shareModal']) => void;
    hideShareModal: () => void;

    // Design System Mode
    designSystemMode: 'classic' | 'modern';
    setDesignSystemMode: (mode: 'classic' | 'modern') => void;
    toggleDesignSystemMode: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null, 
            sidebarOpen: true,
            themeName: (localStorage.getItem('ag-theme-name') as ThemeName) || 'forest',
            darkMode: localStorage.getItem('theme') === 'dark',
            activeTab: 'dashboard',
            farmers: [],
            visits: [],
            notifications: [],
            isLoading: false,
            _activeOperations: 0,
            subscription: null,
            pendingSMS: null,
            contextMenu: null,
            shareModal: null,

            // Actions
            setUser: (user) => set({ user }),

            setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

            setThemeName: (themeName) => {
                localStorage.setItem('ag-theme-name', themeName);
                set({ themeName });
            },

            setDarkMode: (darkMode) => {
                localStorage.setItem('theme', darkMode ? 'dark' : 'light');
                set({ darkMode });
            },
            toggleDarkMode: () => set((state) => {
                const next = !state.darkMode;
                localStorage.setItem('theme', next ? 'dark' : 'light');
                return { darkMode: next };
            }),

            setActiveTab: (activeTab) => set({ activeTab }),

            setFarmers: (farmers) => set({ farmers }),
            addFarmer: (farmer) => set((state) => ({
                farmers: [...state.farmers, farmer]
            })),
            updateFarmer: async (id, updates) => {
                get()._startOperation();
                try {
                    const response = await farmerService.updateFarmer(id, updates);
                    if (response.success) {
                        set((state) => ({
                            farmers: state.farmers.map((f) =>
                                f.id === id ? { ...f, ...updates } : f
                            )
                        }));
                        toast.success('Farmer updated successfully');
                    }
                } catch (error) {

                    toast.error('Failed to update farmer');
                } finally {
                    get()._endOperation();
                }
            },
            updateFarmers: async (ids, updates) => {
                get()._startOperation();
                try {
                    const response = await farmerService.updateFarmers(ids, updates);
                    if (response.success) {
                        set((state) => ({
                            farmers: state.farmers.map((f) =>
                                ids.includes(f.id) ? { ...f, ...updates } : f
                            )
                        }));
                        toast.success(`${ids.length} farmers updated successfully`);
                    }
                } catch (error) {

                    toast.error('Failed to update some farmers');
                } finally {
                    get()._endOperation();
                }
            },
            removeFarmer: async (id) => {
                get()._startOperation();
                try {
                    const response = await farmerService.deleteFarmer(id);
                    if (response.success) {
                        set((state) => ({
                            farmers: state.farmers.filter((f) => f.id !== id)
                        }));
                        toast.success('Farmer removed successfully');
                    }
                } catch (error) {

                    toast.error('Failed to remove farmer');
                } finally {
                    get()._endOperation();
                }
            },
            removeFarmers: async (ids) => {
                get()._startOperation();
                try {
                    // Call the bulk delete API if it exists, or loop
                    const response = await farmerService.deleteFarmers(ids);
                    if (response.success) {
                        set((state) => ({
                            farmers: state.farmers.filter((f) => !ids.includes(f.id))
                        }));
                        toast.success(`${ids.length} farmers removed successfully`);
                    }
                } catch (error) {

                    toast.error('Failed to remove some farmers');
                } finally {
                    get()._endOperation();
                }
            },

            setVisits: (visits) => set({ visits }),
            addVisit: async (visit) => {
                get()._startOperation();
                try {
                    const response = await visitService.createVisit(visit);
                    if (response.success && response.data) {
                        // Map backend visit (snake_case) to frontend Visit (camelCase)
                        const backendVisit = response.data;
                        const newVisit: Visit = {
                            id: backendVisit.id,
                            farmerId: backendVisit.farmer_id || '',
                            farmerName: backendVisit.farmer_name || '',
                            scheduledDate: backendVisit.scheduled_at,
                            status: (backendVisit.status as Visit['status']) || 'pending',
                            notes: backendVisit.notes
                        };
                        set((state) => ({
                            visits: [newVisit, ...state.visits]
                        }));
                        toast.success('Visit scheduled successfully');
                    }
                } catch (error) {

                    toast.error('Failed to schedule visit');
                } finally {
                    get()._endOperation();
                }
            },
            updateVisit: async (id, updates) => {
                get()._startOperation();
                try {
                    const response = await visitService.updateVisit(id, updates);
                    if (response.success) {
                        set((state) => ({
                            visits: state.visits.map((v) =>
                                v.id === id ? { ...v, ...updates } : v
                            )
                        }));
                        toast.success('Visit updated successfully');
                    }
                } catch (error) {

                    toast.error('Failed to update visit');
                } finally {
                    get()._endOperation();
                }
            },

            addNotification: (notification) => {
                const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 
                    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                
                set((state) => ({
                    notifications: [
                        {
                            id,
                            timestamp: Date.now(),
                            read: false,
                            ...notification,
                        },
                        ...state.notifications
                    ].slice(0, 50)
                }));
            },
            markNotificationRead: (id) => set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                )
            })),
            clearNotifications: () => set({ notifications: [] }),

            _startOperation: () => set((state) => {
                const count = state._activeOperations + 1;
                return { _activeOperations: count, isLoading: true };
            }),
            _endOperation: () => set((state) => {
                const count = Math.max(0, state._activeOperations - 1);
                return { _activeOperations: count, isLoading: count > 0 };
            }),
            setLoading: (isLoading) => set({ isLoading }),
            setSubscription: (subscription) => set({ subscription }),
            setPendingSMS: (pendingSMS) => set({ pendingSMS }),

            showContextMenu: (contextMenu) => set({ contextMenu }),
            hideContextMenu: () => set({ contextMenu: null }),

            showShareModal: (shareModal) => set({ shareModal }),
            hideShareModal: () => set({ shareModal: null }),

            designSystemMode: 'modern',
            setDesignSystemMode: (designSystemMode) => set({ designSystemMode }),
            toggleDesignSystemMode: () => set((state) => ({ 
                designSystemMode: state.designSystemMode === 'classic' ? 'modern' : 'classic' 
            })),
        }),
        {
            name: 'ag-extension-storage',
            partialize: (state) => ({
                themeName: state.themeName,
                darkMode: state.darkMode,
                sidebarOpen: state.sidebarOpen,
                activeTab: state.activeTab,
                user: state.user,
                designSystemMode: state.designSystemMode,
            }),
        }
    )
);

export default useAppStore;
