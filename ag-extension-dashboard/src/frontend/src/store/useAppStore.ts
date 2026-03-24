import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeName } from '@/theme';

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
}

// App Store
interface AppState {
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
    updateFarmer: (id: string, updates: Partial<Farmer>) => void;
    removeFarmer: (id: string) => void;

    // Visits
    visits: Visit[];
    setVisits: (visits: Visit[]) => void;
    addVisit: (visit: Visit) => void;
    updateVisit: (id: string, updates: Partial<Visit>) => void;

    // Notifications
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markNotificationRead: (id: string) => void;
    clearNotifications: () => void;

    // Loading states
    isLoading: boolean;
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
    contextMenu: { x: number; y: number; entityType: any; entityId?: string; isBulk?: boolean } | null;
    showContextMenu: (data: AppState['contextMenu']) => void;
    hideContextMenu: () => void;

    shareModal: { entityType: string; entityId: string; entityName?: string } | null;
    showShareModal: (data: AppState['shareModal']) => void;
    hideShareModal: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Initial state
            user: { 
                id: '1', 
                firstName: 'John', 
                lastName: 'Doe', 
                email: 'john@example.com', 
                role: 'admin',
                region: 'Central'
            }, // Mock user for now
            sidebarOpen: true,
            themeName: (localStorage.getItem('ag-theme-name') as ThemeName) || 'forest',
            darkMode: localStorage.getItem('theme') === 'dark',
            activeTab: 'dashboard',
            farmers: [
                { id: '1', firstName: 'John', lastName: 'Banda', latitude: -13.9626, longitude: 33.7741, region: 'Lilongwe', crops: ['maize', 'groundnuts'], location: 'Lilongwe Rural', phone: '+265880000001' },
                { id: '2', firstName: 'Mary', lastName: 'Phiri', latitude: -15.7861, longitude: 35.0058, region: 'Blantyre', crops: ['tobacco'], location: 'Blantyre West', phone: '+265880000002' },
                { id: '3', firstName: 'Peter', lastName: 'Moyo', latitude: -11.8667, longitude: 33.4833, region: 'Mzuzu', crops: ['maize', 'beans'], location: 'Mzuzu City', phone: '+265880000003' },
                { id: '4', firstName: 'Grace', lastName: 'Chirwa', latitude: -14.3783, longitude: 34.2875, region: 'Kasungu', crops: ['tobacco', 'maize'], location: 'Kasungu Central', phone: '+265880000004' },
                { id: '5', firstName: 'James', lastName: 'Zomba', latitude: -15.3866, longitude: 35.3186, region: 'Zomba', crops: ['groundnuts'], location: 'Zomba Plateau', phone: '+265880000005' },
            ],
            visits: [],
            notifications: [],
            isLoading: false,
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
            updateFarmer: (id, updates) => set((state) => ({
                farmers: state.farmers.map((f) =>
                    f.id === id ? { ...f, ...updates } : f
                )
            })),
            removeFarmer: (id) => set((state) => ({
                farmers: state.farmers.filter((f) => f.id !== id)
            })),

            setVisits: (visits) => set({ visits }),
            addVisit: (visit) => set((state) => ({
                visits: [...state.visits, visit]
            })),
            updateVisit: (id, updates) => set((state) => ({
                visits: state.visits.map((v) =>
                    v.id === id ? { ...v, ...updates } : v
                )
            })),

            addNotification: (notification) => set((state) => ({
                notifications: [
                    {
                        ...notification,
                        id: crypto.randomUUID(),
                        timestamp: Date.now(),
                        read: false,
                    },
                    ...state.notifications
                ].slice(0, 50)
            })),
            markNotificationRead: (id) => set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                )
            })),
            clearNotifications: () => set({ notifications: [] }),

            setLoading: (isLoading) => set({ isLoading }),
            setSubscription: (subscription) => set({ subscription }),
            setPendingSMS: (pendingSMS) => set({ pendingSMS }),

            showContextMenu: (contextMenu) => set({ contextMenu }),
            hideContextMenu: () => set({ contextMenu: null }),

            showShareModal: (shareModal) => set({ shareModal }),
            hideShareModal: () => set({ shareModal: null }),
        }),
        {
            name: 'ag-extension-storage',
            partialize: (state) => ({
                themeName: state.themeName,
                darkMode: state.darkMode,
                sidebarOpen: state.sidebarOpen,
                activeTab: state.activeTab,
                user: state.user,
            }),
        }
    )
);

export default useAppStore;
