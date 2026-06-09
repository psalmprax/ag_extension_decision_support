import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Layout,
    Search,
    ChevronRight,
    Sun as SunIcon,
    Moon as MoonIcon,
    Menu,
    Bell,
    Loader2,
    Settings,
    User,
    LogOut,
} from 'lucide-react';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeName } from '@/theme';
import { Farmer } from '../../types/dashboard';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { dropdownVariants } from '@/lib/animations';

interface AppHeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showGlobalSearch: boolean;
    setShowGlobalSearch: (show: boolean) => void;
    isGlobalSearching: boolean;
    globalSearchResults: { type: string; items: { id: string; label: string; sublabel?: string }[] }[];
    handleGlobalSearch: (query: string) => void;
    weatherLocation: string;
    setWeatherLocation: (loc: string) => void;
    apiUnreadCount: number;
    storeUser: { firstName?: string; lastName?: string; email?: string } | null;
    handleLogout: () => void;
    handleOpenFarmerDetail: (farmer: Farmer) => void;
    farmers: Farmer[];
    addNotification: (n: { message: string; type: 'info' | 'warning' | 'error' | 'success' }) => void;
    setIsNotificationPanelOpen: (open: boolean) => void;
    isProfileMenuOpen: boolean;
    setIsProfileMenuOpen: (open: boolean) => void;
    setShowProfileModal: (show: boolean) => void;
    setShowSettingsPanel: (show: boolean) => void;
}

const navItems = [
    { id: 'dashboard', modern: 'Strategic Intelligence', classic: 'Operations Dashboard' },
    { id: 'analytics', modern: 'Growth Optimization', classic: 'System Analytics' },
    { id: 'reports', modern: 'Executive Reporting', classic: 'Data Reports' },
] as const;

export const AppHeader: React.FC<AppHeaderProps> = ({
    sidebarOpen, setSidebarOpen,
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    showGlobalSearch, setShowGlobalSearch,
    isGlobalSearching, globalSearchResults,
    handleGlobalSearch,
    weatherLocation, setWeatherLocation,
    apiUnreadCount,
    storeUser, handleLogout,
    handleOpenFarmerDetail, farmers,
    addNotification,
    setIsNotificationPanelOpen,
    isProfileMenuOpen, setIsProfileMenuOpen,
    setShowProfileModal, setShowSettingsPanel,
}) => {
    const { isModern, design, headingClass, subtextClass } = useThemeClasses();
    const { darkMode, setDarkMode, themeName, setThemeName, toggleDesignSystemMode } = useAppStore();

    const headerClass = cn(
        'fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)]',
        isModern ? 'bg-white/30 dark:bg-slate-950/30' : 'bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800'
    );

    const navBtnClass = (isActive: boolean) => cn(
        'font-headline tracking-tight transition-all px-4 py-2',
        isModern
            ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(var(--color-primary-400-rgb),0.2)]'
            : 'rounded-none border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-[10px] uppercase tracking-widest',
        isActive
            ? (isModern ? 'text-primary-700 dark:text-primary-400 font-black' : 'bg-slate-900 text-white')
            : 'text-slate-500'
    );

    return (
        <header className={headerClass}>
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-white/5 transition-all text-gray-400"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg" />
                </div>
                <nav className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => React.startTransition(() => setActiveTab(item.id))}
                            className={navBtnClass(activeTab === item.id)}
                        >
                            {isModern ? item.modern : item.classic}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        aria-label="Search system or location"
                        placeholder="Search system or location..."
                        className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-primary-400 outline-none w-64 transition-all text-gray-900 dark:text-white"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleGlobalSearch(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchQuery.trim() && globalSearchResults.length === 0) {
                                setWeatherLocation(searchQuery);
                                addNotification({ message: `Weather now showing for ${searchQuery}`, type: 'info' });
                                setSearchQuery('');
                                setShowGlobalSearch(false);
                            }
                        }}
                        onFocus={() => { if (searchQuery.trim()) setShowGlobalSearch(true); }}
                        onBlur={() => { setTimeout(() => setShowGlobalSearch(false), 200); }}
                    />
                    {showGlobalSearch && globalSearchResults.length > 0 && (
                        <div className="absolute top-full mt-2 left-0 right-0 glass-panel rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                            {isGlobalSearching ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Searching...
                                </div>
                            ) : (
                                globalSearchResults.map((group) => (
                                    <div key={group.type}>
                                        <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.type}</div>
                                        {group.items.map((item) => (
                                            <button
                                                key={item.id}
                                                className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3"
                                                onClick={() => {
                                                    if (group.type === 'Farmers') {
                                                        const farmer = farmers?.find((f: Farmer) => f.id === item.id);
                                                        if (farmer) handleOpenFarmerDetail(farmer);
                                                    } else if (group.type === 'Visits') {
                                                        React.startTransition(() => setActiveTab('visits'));
                                                    } else {
                                                        React.startTransition(() => setActiveTab('knowledge'));
                                                        setSearchQuery(item.label);
                                                    }
                                                    setShowGlobalSearch(false);
                                                }}
                                            >
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.label}</p>
                                                    {item.sublabel && <p className="text-xs text-slate-500 truncate">{item.sublabel}</p>}
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-500" />
                                            </button>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="hidden xl:block ml-2">
                    <WeatherWidget location={weatherLocation} />
                </div>

                <div className="flex items-center gap-3 border-r border-gray-200 dark:border-white/10 pr-4">
                    <div className="hidden lg:flex items-center gap-2 scale-90 origin-right">
                        <button
                            onClick={toggleDesignSystemMode}
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all',
                                isModern
                                    ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98] bg-primary-600/10 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
                                    : 'rounded-none border border-slate-300 dark:border-slate-700 font-mono bg-gray-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                            )}
                            title="Toggle Design Aesthetic"
                        >
                            <Layout className="w-3.5 h-3.5" />
                            {isModern ? 'Modern' : 'Classic'}
                        </button>
                        <LanguageSwitcher compact />
                        <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
                    </div>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-primary-400/50 hover:bg-white/10 transition-all text-slate-400 hover:text-primary-400 backdrop-blur-sm"
                        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setIsNotificationPanelOpen(true)} className="text-slate-400 hover:text-primary-400 transition-colors p-2 rounded-full hover:bg-white/5 relative">
                        <Bell className="w-5 h-5" />
                        {apiUnreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-400 rounded-full animate-pulse"></span>
                        )}
                    </button>
                    <button onClick={() => setShowSettingsPanel(true)} className="text-slate-400 hover:text-primary-400 transition-colors p-2 rounded-full hover:bg-white/5">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className="flex items-center gap-3 pl-4 border-l border-white/10 hover:opacity-80 transition-opacity"
                    >
                        <div className="w-8 h-8 rounded-full border border-primary-400/30 overflow-hidden ring-2 ring-primary-400/10 flex items-center justify-center bg-slate-800">
                            <span className="text-[10px] text-primary-400 font-bold">{storeUser?.firstName?.[0]}{storeUser?.lastName?.[0]}</span>
                        </div>
                        <div className="hidden xl:block text-left">
                            <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">
                                {storeUser?.firstName} {storeUser?.lastName}
                            </p>
                        </div>
                    </button>

                    <AnimatePresence>
                        {isProfileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                                <motion.div
                                    variants={dropdownVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-2xl p-2 z-50"
                                >
                                    <div className="p-3 mb-2 border-b border-white/10">
                                        <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', subtextClass)}>Account Info</p>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{storeUser?.email}</p>
                                    </div>

                                    <button onClick={() => { setIsProfileMenuOpen(false); setShowProfileModal(true); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300">
                                        <User className="w-4 h-4 text-primary-400" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Profile</span>
                                    </button>
                                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400">
                                        <LogOut className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
};
