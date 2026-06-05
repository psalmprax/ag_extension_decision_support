import { create } from 'zustand';
import toast from 'react-hot-toast';
import type { Farmer, Visit, Notification } from './useAppStore';
import * as farmerService from '@/api/farmerService';
import * as visitService from '@/api/visitService';

interface DataState {
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

    // Subscription & Usage
    subscription: {
        plan: { name: string; status: string };
        usage: { type: string; current: number; limit: number; label: string }[];
        periodEnd: string;
    } | null;
    setSubscription: (subscription: DataState['subscription']) => void;

    // Cross-route data
    pendingSMS: { phone: string; name: string } | null;
    setPendingSMS: (data: { phone: string; name: string } | null) => void;

    // Loading (counter-based for concurrent mutations)
    isLoading: boolean;
    _activeOperations: number;
    _startOperation: () => void;
    _endOperation: () => void;
    setLoading: (loading: boolean) => void;
}

export const useDataStore = create<DataState>()((set, get) => ({
    farmers: [],
    visits: [],
    notifications: [],
    subscription: null,
    pendingSMS: null,
    isLoading: false,
    _activeOperations: 0,

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
        } catch {
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
        } catch {
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
        } catch {
            toast.error('Failed to remove farmer');
        } finally {
            get()._endOperation();
        }
    },
    removeFarmers: async (ids) => {
        get()._startOperation();
        try {
            const response = await farmerService.deleteFarmers(ids);
            if (response.success) {
                set((state) => ({
                    farmers: state.farmers.filter((f) => !ids.includes(f.id))
                }));
                toast.success(`${ids.length} farmers removed successfully`);
            }
        } catch {
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
        } catch {
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
        } catch {
            toast.error('Failed to update visit');
        } finally {
            get()._endOperation();
        }
    },

    addNotification: (notification) => set((state) => ({
        notifications: [
            {
                ...notification,
                id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                timestamp: new Date().toISOString(),
                read: false,
            },
            ...state.notifications,
        ].slice(0, 50),
    })),
    markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        ),
    })),
    clearNotifications: () => set({ notifications: [] }),

    setSubscription: (subscription) => set({ subscription }),
    setPendingSMS: (pendingSMS) => set({ pendingSMS }),

    _startOperation: () => set((state) => {
        const count = state._activeOperations + 1;
        return { _activeOperations: count, isLoading: true };
    }),
    _endOperation: () => set((state) => {
        const count = Math.max(0, state._activeOperations - 1);
        return { _activeOperations: count, isLoading: count > 0 };
    }),
    setLoading: (isLoading) => set({ isLoading }),
}));
