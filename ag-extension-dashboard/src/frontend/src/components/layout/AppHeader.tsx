import React from 'react';
import { Link } from 'react-router-dom';
import { Layout, Sun as SunIcon, Moon as MoonIcon, Menu, Bell, Settings } from 'lucide-react';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Farmer } from '../../types/dashboard';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { GlobalSearch } from './GlobalSearch';
import { ProfileMenu } from './ProfileMenu';

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
  globalSearchResults: {
    type: string;
    items: { id: string; label: string; sublabel?: string }[];
  }[];
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
  { id: 'dashboard', modern: 'Dashboard', classic: 'Dashboard' },
  { id: 'analytics', modern: 'Growth Optimization', classic: 'System Analytics' },
  { id: 'reports', modern: 'Executive Reporting', classic: 'Data Reports' },
] as const;

export const AppHeader: React.FC<AppHeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  showGlobalSearch,
  setShowGlobalSearch,
  isGlobalSearching,
  globalSearchResults,
  handleGlobalSearch,
  weatherLocation,
  setWeatherLocation,
  apiUnreadCount,
  storeUser,
  handleLogout,
  handleOpenFarmerDetail,
  farmers,
  addNotification,
  setIsNotificationPanelOpen,
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  setShowProfileModal,
  setShowSettingsPanel,
}) => {
  const { isModern } = useThemeClasses();
  const { darkMode, setDarkMode, themeName, setThemeName, toggleDesignSystemMode } = useAppStore();

  const headerClass = cn(
    'fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-[0_4px_30px_var(--color-outline)] dark:shadow-[0_4px_30px_var(--color-outline)]',
    isModern
      ? 'bg-white/30 dark:bg-slate-950/30'
      : 'bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800'
  );

  const navBtnClass = (isActive: boolean) =>
    cn(
      'font-headline tracking-tight transition-all px-4 py-2',
      isModern
        ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_var(--color-outline)]'
        : 'rounded-none border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-xxs uppercase tracking-widest',
      isActive
        ? isModern
          ? 'text-cyan-700 dark:text-cyan-400 font-black'
          : 'bg-slate-900 text-white'
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
          <Link to="/dashboard" aria-label="Go to dashboard">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
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
        <GlobalSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showGlobalSearch={showGlobalSearch}
          setShowGlobalSearch={setShowGlobalSearch}
          isGlobalSearching={isGlobalSearching}
          globalSearchResults={globalSearchResults}
          handleGlobalSearch={handleGlobalSearch}
          setWeatherLocation={setWeatherLocation}
          addNotification={addNotification}
          farmers={farmers}
          handleOpenFarmerDetail={handleOpenFarmerDetail}
          setActiveTab={setActiveTab}
        />

        <div className="hidden xl:block ml-2">
          <WeatherWidget location={weatherLocation} />
        </div>

        <div className="flex items-center gap-3 border-r border-gray-200 dark:border-white/10 pr-4">
          <div className="hidden lg:flex items-center gap-2 scale-90 origin-right">
            <button
              onClick={toggleDesignSystemMode}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xxs font-bold uppercase tracking-widest transition-all',
                isModern
                  ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98] bg-cyan-600/10 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400'
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
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/50 hover:bg-white/10 transition-all text-slate-400 hover:text-cyan-400 backdrop-blur-sm"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNotificationPanelOpen(true)}
            className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5 relative"
          >
            <Bell className="w-5 h-5" />
            {apiUnreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <ProfileMenu
          isProfileMenuOpen={isProfileMenuOpen}
          setIsProfileMenuOpen={setIsProfileMenuOpen}
          storeUser={storeUser}
          setShowProfileModal={setShowProfileModal}
          handleLogout={handleLogout}
        />
      </div>
    </header>
  );
};
