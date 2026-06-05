import { create } from 'zustand';

export type ThemeName = 'ocean' | 'sunset' | 'forest' | 'midnight' | 'lavender';

interface UIState {
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

    // Design System Mode
    designSystemMode: 'classic' | 'modern';
    setDesignSystemMode: (mode: 'classic' | 'modern') => void;
    toggleDesignSystemMode: () => void;

    // Context Menu
    contextMenu: { x: number; y: number; entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user' | 'stat'; entityId?: string; isBulk?: boolean } | null;
    showContextMenu: (data: UIState['contextMenu']) => void;
    hideContextMenu: () => void;

    // Share Modal
    shareModal: { entityType: string; entityId: string; entityName?: string } | null;
    showShareModal: (data: UIState['shareModal']) => void;
    hideShareModal: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
    sidebarOpen: true,
    themeName: (localStorage.getItem('ag-theme-name') as ThemeName) || 'forest',
    darkMode: localStorage.getItem('theme') === 'dark',
    activeTab: 'dashboard',
    designSystemMode: (localStorage.getItem('designSystemMode') as 'classic' | 'modern') || 'modern',
    contextMenu: null,
    shareModal: null,

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

    setDesignSystemMode: (mode) => {
        localStorage.setItem('designSystemMode', mode);
        set({ designSystemMode: mode });
    },
    toggleDesignSystemMode: () => set((state) => ({
        designSystemMode: state.designSystemMode === 'modern' ? 'classic' : 'modern',
    })),

    showContextMenu: (data) => set({ contextMenu: data }),
    hideContextMenu: () => set({ contextMenu: null }),

    showShareModal: (data) => set({ shareModal: data }),
    hideShareModal: () => set({ shareModal: null }),
}));
