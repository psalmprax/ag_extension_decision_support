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
  role: 'admin' | 'regional_manager' | 'extension_officer' | 'farmer';
  region?: string;
  planName?: string;
  isFree?: boolean;
}

export interface Farmer {
  id: string;
  firstName: string;
  lastName: string;
  location?: string;
  village?: string;
  phone?: string;
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

  // Demo mode
  isDemo: boolean;
  setIsDemo: (isDemo: boolean) => void;

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

  // Liquid background effect
  liquidEffect: boolean;
  setLiquidEffect: (enabled: boolean) => void;
  toggleLiquidEffect: () => void;

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
  contextMenu: {
    x: number;
    y: number;
    entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user' | 'stat';
    entityId?: string;
    isBulk?: boolean;
  } | null;
  showContextMenu: (data: AppState['contextMenu']) => void;
  hideContextMenu: () => void;

  shareModal: { entityType: string; entityId: string; entityName?: string } | null;
  showShareModal: (data: AppState['shareModal']) => void;
  hideShareModal: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      // Initial state
      user: null,
      isDemo: false,
      sidebarOpen: true,
      themeName: (localStorage.getItem('ag-theme-name') as ThemeName) || 'forest',
      darkMode: localStorage.getItem('theme') === 'dark',
      liquidEffect: localStorage.getItem('ag-liquid-effect') === 'true',
      activeTab: 'dashboard',
      farmers: [],
      visits: [],
      notifications: [],
      isLoading: false,
      subscription: null,
      pendingSMS: null,
      contextMenu: null,
      shareModal: null,

      // Actions
      setUser: user => set({ user }),
      setIsDemo: isDemo => set({ isDemo }),

      setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

      setThemeName: themeName => {
        localStorage.setItem('ag-theme-name', themeName);
        set({ themeName });
      },

      setDarkMode: darkMode => {
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        set({ darkMode });
      },
      toggleDarkMode: () =>
        set(state => {
          const next = !state.darkMode;
          localStorage.setItem('theme', next ? 'dark' : 'light');
          return { darkMode: next };
        }),

      setLiquidEffect: liquidEffect => {
        localStorage.setItem('ag-liquid-effect', String(liquidEffect));
        set({ liquidEffect });
      },
      toggleLiquidEffect: () =>
        set(state => {
          const next = !state.liquidEffect;
          localStorage.setItem('ag-liquid-effect', String(next));
          return { liquidEffect: next };
        }),

      setActiveTab: activeTab => set({ activeTab }),

      setFarmers: farmers => set({ farmers }),
      addFarmer: farmer =>
        set(state => ({
          farmers: [...state.farmers, farmer],
        })),
      updateFarmer: async (id, updates) => {
        set({ isLoading: true });
        try {
          const response = await farmerService.updateFarmer(id, updates);
          if (response.success) {
            set(state => ({
              farmers: state.farmers.map(f => (f.id === id ? { ...f, ...updates } : f)),
            }));
            toast.success('Farmer updated successfully');
          }
        } catch (error) {
          console.error('Update farmer error:', error);
          toast.error('Failed to update farmer');
        } finally {
          set({ isLoading: false });
        }
      },
      updateFarmers: async (ids, updates) => {
        set({ isLoading: true });
        try {
          const response = await farmerService.updateFarmers(ids, updates);
          if (response.success) {
            set(state => ({
              farmers: state.farmers.map(f => (ids.includes(f.id) ? { ...f, ...updates } : f)),
            }));
            toast.success(`${ids.length} farmers updated successfully`);
          }
        } catch (error) {
          console.error('Bulk update farmers error:', error);
          toast.error('Failed to update some farmers');
        } finally {
          set({ isLoading: false });
        }
      },
      removeFarmer: async id => {
        set({ isLoading: true });
        try {
          const response = await farmerService.deleteFarmer(id);
          if (response.success) {
            set(state => ({
              farmers: state.farmers.filter(f => f.id !== id),
            }));
            toast.success('Farmer removed successfully');
          }
        } catch (error) {
          console.error('Remove farmer error:', error);
          toast.error('Failed to remove farmer');
        } finally {
          set({ isLoading: false });
        }
      },
      removeFarmers: async ids => {
        set({ isLoading: true });
        try {
          // Call the bulk delete API if it exists, or loop
          const response = await farmerService.deleteFarmers(ids);
          if (response.success) {
            set(state => ({
              farmers: state.farmers.filter(f => !ids.includes(f.id)),
            }));
            toast.success(`${ids.length} farmers removed successfully`);
          }
        } catch (error) {
          console.error('Bulk remove farmers error:', error);
          toast.error('Failed to remove some farmers');
        } finally {
          set({ isLoading: false });
        }
      },

      setVisits: visits => set({ visits }),
      addVisit: async visit => {
        set({ isLoading: true });
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
              notes: backendVisit.notes,
            };
            set(state => ({
              visits: [newVisit, ...state.visits],
            }));
            toast.success('Visit scheduled successfully');
          }
        } catch (error) {
          console.error('Add visit error:', error);
          toast.error('Failed to schedule visit');
        } finally {
          set({ isLoading: false });
        }
      },
      updateVisit: async (id, updates) => {
        set({ isLoading: true });
        try {
          const response = await visitService.updateVisit(id, updates);
          if (response.success) {
            set(state => ({
              visits: state.visits.map(v => (v.id === id ? { ...v, ...updates } : v)),
            }));
            toast.success('Visit updated successfully');
          }
        } catch (error) {
          console.error('Update visit error:', error);
          toast.error('Failed to update visit');
        } finally {
          set({ isLoading: false });
        }
      },

      addNotification: notification => {
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15) +
              Math.random().toString(36).substring(2, 15);

        set(state => ({
          notifications: [
            {
              id,
              timestamp: Date.now(),
              read: false,
              ...notification,
            },
            ...state.notifications,
          ].slice(0, 50),
        }));
      },
      markNotificationRead: id =>
        set(state => ({
          notifications: state.notifications.map(n => (n.id === id ? { ...n, read: true } : n)),
        })),
      clearNotifications: () => set({ notifications: [] }),

      setLoading: isLoading => set({ isLoading }),
      setSubscription: subscription => set({ subscription }),
      setPendingSMS: pendingSMS => set({ pendingSMS }),

      showContextMenu: contextMenu => set({ contextMenu }),
      hideContextMenu: () => set({ contextMenu: null }),

      showShareModal: shareModal => set({ shareModal }),
      hideShareModal: () => set({ shareModal: null }),
    }),
    {
      name: 'ag-extension-storage',
      partialize: state => ({
        themeName: state.themeName,
        darkMode: state.darkMode,
        sidebarOpen: state.sidebarOpen,
        activeTab: state.activeTab,
        user: state.user,
        isDemo: state.isDemo,
      }),
    }
  )
);

export default useAppStore;
