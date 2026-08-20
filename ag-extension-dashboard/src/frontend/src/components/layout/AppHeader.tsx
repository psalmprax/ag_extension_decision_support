import React from 'react';
import { Link } from 'react-router-dom';
import { Sun as SunIcon, Moon as MoonIcon, Menu, Bell, Settings, Leaf, Activity, Send } from 'lucide-react';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Farmer } from '../../types/dashboard';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { GlobalSearch } from './GlobalSearch';
import { ProfileMenu } from './ProfileMenu';

interface AppHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
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

export const AppHeader: React.FC<AppHeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
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
  const { darkMode, setDarkMode, themeName, setThemeName } = useAppStore();

  const headerClass = cn(
    'fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-[0_4px_30px_var(--color-outline)] dark:shadow-[0_4px_30px_var(--color-outline)]',
    'bg-white/30 dark:bg-slate-950/30'
  );

  return (
    <header className={headerClass}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-12 w-12 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all text-gray-400"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/dashboard" aria-label="Go to dashboard">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-8 h-8 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>

        {/* ── Quick-Action Interest Pills for First-Time Clients ── */}
        <div className="hidden md:flex items-center gap-2 border-l border-white/10 pl-4">
          <button
            onClick={() => React.startTransition(() => setActiveTab('disease_diagnosis'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/40 text-xs font-bold transition-all shadow-sm shadow-emerald-950/20 active:scale-95"
            title="Instant Edge AI Plant Disease Scanner"
          >
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instant AI Scan</span>
          </button>

          <button
            onClick={() => React.startTransition(() => setActiveTab('telemetry'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 hover:border-sky-500/40 text-xs font-bold transition-all shadow-sm shadow-sky-950/20 active:scale-95"
            title="Live Geospatial Weather & Soil Telemetry"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Live Field Radar</span>
          </button>

          <button
            onClick={() => React.startTransition(() => setActiveTab('sms'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 hover:border-purple-500/40 text-xs font-bold transition-all shadow-sm shadow-purple-950/20 active:scale-95"
            title="Interactive SMS & USSD Bot Sandbox"
          >
            <Send className="w-3.5 h-3.5 text-purple-400" />
            <span>Test SMS Bot</span>
          </button>
        </div>
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
            <LanguageSwitcher compact />
            <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="h-12 w-12 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:border-primary-400/50 hover:bg-white/10 transition-all text-slate-400 hover:text-primary-400 backdrop-blur-sm"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNotificationPanelOpen(true)}
            className="text-slate-400 hover:text-primary-400 transition-colors h-12 w-12 flex items-center justify-center rounded-full hover:bg-white/5 relative"
          >
            <Bell className="w-6 h-6" />
            {apiUnreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary-400 rounded-full animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="text-slate-400 hover:text-primary-400 transition-colors h-12 w-12 flex items-center justify-center rounded-full hover:bg-white/5"
          >
            <Settings className="w-6 h-6" />
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
