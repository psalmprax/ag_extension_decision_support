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

interface AppHeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
    themeName: ThemeName;
    setThemeName: (name: ThemeName) => void;
    isModern: boolean;
    toggleDesignSystemMode: () => void;
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
    isNotificationPanelOpen?: boolean;
    setIsNotificationPanelOpen: (open: boolean) => void;
    isProfileMenuOpen: boolean;
    setIsProfileMenuOpen: (open: boolean) => void;
    setShowProfileModal: (show: boolean) => void;
    setShowSettingsPanel: (show: boolean) => void;
    headerOpacity: string;
    btnClass: string;
    headingClass: string;
    subtextClass: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    sidebarOpen, setSidebarOpen,
    activeTab, setActiveTab,
    darkMode, setDarkMode,
    themeName, setThemeName,
    isModern, toggleDesignSystemMode,
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
    headerOpacity, btnClass, headingClass, subtextClass,
}) => {
    return (
        <header className={`fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 ${headerOpacity} backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)]`}>
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-white/5 transition-all text-gray-400"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className={`text-2xl font-headline ${headingClass}`}>AG-extension</span>
                </div>
                <nav className="hidden md:flex items-center gap-1">
                    <button onClick={() => React.startTransition(() => setActiveTab('dashboard'))} className={`font-headline tracking-tight transition-all px-4 py-2 ${btnClass} ${activeTab === 'dashboard' ? (isModern ? 'text-cyan-700 dark:text-cyan-400 font-black' : 'bg-slate-900 text-white') : 'text-slate-500'}`}>
                        {isModern ? 'Strategic Intelligence' : 'Operations Dashboard'}
                    </button>
                    <button onClick={() => React.startTransition(() => setActiveTab('analytics'))} className={`font-headline tracking-tight transition-all px-4 py-2 ${btnClass} ${activeTab === 'analytics' ? (isModern ? 'text-cyan-700 dark:text-cyan-400 font-black' : 'bg-slate-900 text-white') : 'text-slate-500'}`}>
                        {isModern ? 'Growth Optimization' : 'System Analytics'}
                    </button>
                    <button onClick={() => React.startTransition(() => setActiveTab('reports'))} className={`font-headline tracking-tight transition-all px-4 py-2 ${btnClass} ${activeTab === 'reports' ? (isModern ? 'text-cyan-700 dark:text-cyan-400 font-black' : 'bg-slate-900 text-white') : 'text-slate-500'}`}>
                        {isModern ? 'Executive Reporting' : 'Data Reports'}
                    </button>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search system or location..."
                        className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-cyan-400 outline-none w-64 transition-all text-gray-900 dark:text-white"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleGlobalSearch(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchQuery.trim() && globalSearchResults.length === 0) {
                                setWeatherLocation(searchQuery);
                                addNotification({
                                    message: `Weather now showing for ${searchQuery}`,
                                    type: 'info'
                                });
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
                            className={`flex items-center gap-2 px-3 py-1.5 ${btnClass} text-[10px] font-bold uppercase tracking-widest transition-all ${isModern ? 'bg-cyan-600/10 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400' : `bg-gray-100 dark:bg-white/5 ${subtextClass}`}`}
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
                        className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/50 hover:bg-white/10 transition-all text-slate-400 hover:text-cyan-400 backdrop-blur-sm"
                        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setIsNotificationPanelOpen(true)} className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5 relative">
                        <Bell className="w-5 h-5" />
                        {apiUnreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                        )}
                    </button>
                    <button onClick={() => setShowSettingsPanel(true)} className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className="flex items-center gap-3 pl-4 border-l border-white/10 hover:opacity-80 transition-opacity"
                    >
                        <div className="w-8 h-8 rounded-full border border-cyan-400/30 overflow-hidden ring-2 ring-cyan-400/10 flex items-center justify-center bg-slate-800">
                            <span className="text-[10px] text-cyan-400 font-bold">{storeUser?.firstName?.[0]}{storeUser?.lastName?.[0]}</span>
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
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-2xl p-2 z-50"
                                >
                                    <div className="p-3 mb-2 border-b border-white/10">
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${subtextClass}`}>Account Info</p>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{storeUser?.email}</p>
                                    </div>

                                    <button onClick={() => { setIsProfileMenuOpen(false); setShowProfileModal(true); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300">
                                        <User className="w-4 h-4 text-cyan-400" />
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
