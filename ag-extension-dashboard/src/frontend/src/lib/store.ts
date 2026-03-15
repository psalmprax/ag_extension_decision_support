import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types
export interface User {
    id: string
    firstName: string
    lastName: string
    email: string
    role: 'admin' | 'extension_officer' | 'farmer'
}

export interface Farmer {
    id: string
    name: string
    location: string
    phone: string
    languagePreference?: string
    crops?: string[]
    farmSize?: number
}

export interface Visit {
    id: string
    farmerId: string
    farmerName: string
    scheduledDate: string
    status: 'pending' | 'completed' | 'cancelled'
    notes?: string
}

export interface Notification {
    id: string
    type: 'info' | 'warning' | 'error' | 'success'
    message: string
    timestamp: number
    read: boolean
}

// App Store
interface AppState {
    // User
    user: User | null
    setUser: (user: User | null) => void

    // Sidebar
    sidebarOpen: boolean
    setSidebarOpen: (open: boolean) => void

    // Theme
    themeName: string
    setThemeName: (name: string) => void

    // Dark mode
    darkMode: boolean
    setDarkMode: (enabled: boolean) => void

    // Farmers
    farmers: Farmer[]
    setFarmers: (farmers: Farmer[]) => void
    addFarmer: (farmer: Farmer) => void
    updateFarmer: (id: string, updates: Partial<Farmer>) => void
    removeFarmer: (id: string) => void

    // Visits
    visits: Visit[]
    setVisits: (visits: Visit[]) => void
    addVisit: (visit: Visit) => void
    updateVisit: (id: string, updates: Partial<Visit>) => void

    // Notifications
    notifications: Notification[]
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
    markNotificationRead: (id: string) => void
    clearNotifications: () => void

    // Loading states
    isLoading: boolean
    setLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Initial state
            user: null,
            sidebarOpen: true,
            themeName: 'forest',
            darkMode: false,
            farmers: [],
            visits: [],
            notifications: [],
            isLoading: false,

            // Actions
            setUser: (user) => set({ user }),

            setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

            setThemeName: (themeName) => set({ themeName }),

            setDarkMode: (darkMode) => set({ darkMode }),

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
                ].slice(0, 50) // Keep max 50 notifications
            })),

            markNotificationRead: (id) => set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                )
            })),

            clearNotifications: () => set({ notifications: [] }),

            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: 'ag-extension-storage',
            partialize: (state) => ({
                themeName: state.themeName,
                darkMode: state.darkMode,
                sidebarOpen: state.sidebarOpen,
            }),
        }
    )
)

export default useAppStore
