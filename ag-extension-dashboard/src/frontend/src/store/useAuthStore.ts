import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './useAppStore';

interface AuthState {
    user: User | null;
    setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user) => set({ user }),
        }),
        {
            name: 'ag-extension-auth',
            partialize: (state) => ({ user: state.user }),
        }
    )
);
