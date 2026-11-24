import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeName } from '@/theme';
import * as farmerService from '@/api/farmerService';
import * as visitService from '@/api/visitService';
import { randomId } from '@/lib/randomId';
import { toast } from 'react-hot-toast';
import { isDemoSession } from '@/demo/demoSession';
import { safeStorage } from '@/lib/safeStorage';
import { setDeviceOwner } from '@/lib/offlineReadCache';

// Types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'regional_manager' | 'extension_officer' | 'farmer';
  region?: string;
  /** Country the account works in (English name, as in the country profiles). */
  country?: string | null;
  /** IANA time zone; null means the country's main one. */
  timeZone?: string | null;
  phone?: string;
  planName?: string;
  isFree?: boolean;
  isDemo?: boolean;
  /** Above every tenant: may create or promote an admin. */
  isSystemAdmin?: boolean;
  notificationPreferences?: NotificationPreferences;
  /** Handle, avatar and display units saved on the account (PATCH /auth/me). */
  profileSettings?: ProfileSettings;
  /** Paid services the system administrator opened to this Free account (GET /auth/me). */
  serviceAccess?: string[];
}

export interface ProfileSettings {
  handle?: string;
  avatarId?: string;
  areaUnit?: 'hectares' | 'acres';
  tempUnit?: 'celsius' | 'fahrenheit';
  highContrast?: boolean;
}

/** Alert channels the user switched on or off in Settings (missing = on). */
export interface NotificationPreferences {
  emailAlerts?: boolean;
  smsAlerts?: boolean;
  pushNotifications?: boolean;
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
  assignedOfficerId?: string;
  /** Out of 100. */
  vitalScore?: number;
  /** Recorded harvests, tonnes per hectare. */
  yieldHistory?: { month: string; yield: number }[];
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

function showNotificationToast(type: Notification['type'], message: string): void {
  if (type === 'success') toast.success(message);
  else if (type === 'error') toast.error(message);
  else toast(message);
}

// App Store
safeStorage.remove('ag-liquid-effect');

const getInitialThemeName = (): ThemeName => (safeStorage.get('ag-theme-name') as ThemeName) || 'forest';

const getInitialDarkMode = (): boolean => safeStorage.get('theme') === 'dark';

const safeSetLocalStorage = (key: string, value: string): void => {
  safeStorage.set(key, value);
};

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
  /** Shows the message as a toast and keeps it in the notification list. */
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
  pendingSMS: { phone: string; name?: string; message?: string } | null;
  setPendingSMS: (data: { phone: string; name?: string; message?: string } | null) => void;

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

  // Audio Accessibility
  preferredAudioLanguage: string;
  setPreferredAudioLanguage: (lang: string) => void;
}

/** md breakpoint: below it the sidebar overlays the page as a drawer. */
function isWideViewport(): boolean {
  return typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 768px)').matches;
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      // Initial state
      user: null,
      isDemo: false,
      sidebarOpen: isWideViewport(),
      themeName: getInitialThemeName(),
      darkMode: getInitialDarkMode(),
      activeTab: 'dashboard',
      preferredAudioLanguage: 'sw',
      farmers: [],
      visits: [],
      notifications: [],
      isLoading: false,
      subscription: null,
      pendingSMS: null,
      contextMenu: null,
      shareModal: null,

      // Actions
      setUser: user => set(state => ({
        user,
        isDemo: user ? isDemoSession(user, false) : false,
        ...(state.user?.id !== user?.id ? {
          farmers: [], visits: [], notifications: [], pendingSMS: null, subscription: null,
        } : {}),
      })),
      setPreferredAudioLanguage: preferredAudioLanguage => set({ preferredAudioLanguage }),
      setIsDemo: isDemo => set(_state => {
        // When exiting demo mode, clear all demo data from the store
        if (!isDemo) {
          return { isDemo: false, farmers: [], visits: [] };
        }
        return { isDemo };
      }),

      setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

      setThemeName: themeName => {
        safeSetLocalStorage('ag-theme-name', themeName);
        set({ themeName });
      },

      setDarkMode: darkMode => {
        safeSetLocalStorage('theme', darkMode ? 'dark' : 'light');
        set({ darkMode });
      },
      toggleDarkMode: () =>
        set(state => {
          const next = !state.darkMode;
          safeSetLocalStorage('theme', next ? 'dark' : 'light');
          return { darkMode: next };
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
          } else {
            // A success:false response changes nothing on screen; say so.
            toast.error('Failed to update farmer');
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
          } else {
            toast.error('Failed to update farmers');
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
          } else {
            toast.error(`Failed to remove farmer: ${response.error}`);
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
          } else {
            toast.error('Failed to remove farmers');
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
          } else {
            toast.error('Failed to schedule visit');
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
          } else {
            toast.error('Failed to update visit');
          }
        } catch (error) {
          console.error('Update visit error:', error);
          toast.error('Failed to update visit');
        } finally {
          set({ isLoading: false });
        }
      },

      addNotification: notification => {
        const id = randomId();
        // Until this toasted, confirmations and errors raised this way only reached the bell list.
        showNotificationToast(notification.type, notification.message);

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
      onRehydrateStorage: () => state => {
        // The sidebar is a drawer on phones: never restore it open over the page.
        if (state && state.sidebarOpen && !isWideViewport()) state.setSidebarOpen(false);
        if (!state?.user) return;
        const isDemo = isDemoSession(state.user, state.isDemo);
        if (state.isDemo !== isDemo) state.setIsDemo(isDemo);
      },
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

// Copies kept for offline use and writes waiting to sync belong to whoever is signed in.
setDeviceOwner(useAppStore.getState().user?.id ?? null);
useAppStore.subscribe(state => setDeviceOwner(state.user?.id ?? null));

export default useAppStore;
