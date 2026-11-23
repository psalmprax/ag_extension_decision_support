import React from 'react';
import { Link } from 'react-router-dom';
import { Sun as SunIcon, Moon as MoonIcon, Menu, Bell, Settings, Leaf, Activity, Send } from 'lucide-react';
import { WeatherWidget } from '@/components/WeatherWidget';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Farmer } from '../../types/dashboard';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { GlobalSearch } from './GlobalSearch';
import { ProfileMenu } from './ProfileMenu';
import { useLanguage } from '@/lib/LanguageContext';

const ICON_BUTTON =
  'h-10 w-10 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white transition-colors';

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
  const { darkMode, setDarkMode, user } = useAppStore();
  const { t } = useLanguage();
  // Demo shortcuts open admin tooling (scanner sandbox, telemetry, SMS bot);
  // officers and farmers reach their own tools from the sidebar.
  const showAdminShortcuts = user?.role === 'admin';

  const shortcuts = [
    { tab: 'disease_diagnosis', icon: Leaf, label: t('header_instant_ai_scan', { defaultValue: 'Scan a leaf' }), title: t('header_edge_ai_tooltip', { defaultValue: 'Check a crop photo for disease' }) },
    { tab: 'telemetry', icon: Activity, label: t('header_live_field_radar', { defaultValue: 'Field conditions' }), title: t('header_radar_tooltip', { defaultValue: 'Weather and soil readings by area' }) },
    { tab: 'sms', icon: Send, label: t('header_test_sms_bot', { defaultValue: 'SMS preview' }), title: t('header_bot_tooltip', { defaultValue: 'Try the SMS and USSD menus' }) },
  ];

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-3 sm:px-5 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b border-slate-900/[0.08] dark:border-white/[0.08] max-md:ios-bar md:bg-white md:dark:bg-theme-bg-primary">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Phones open the menu from the bottom bar, so the top button is for wider screens. */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(ICON_BUTTON, 'hidden md:flex')}
            aria-label={t('header_toggle_navigation', { defaultValue: 'Toggle navigation menu' })}
            aria-expanded={sidebarOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/dashboard" aria-label={t('header_go_dashboard', { defaultValue: 'Go to dashboard' })}>
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-md" />
          </Link>
        </div>

        {showAdminShortcuts && (
          <div role="group" aria-label={t('header_shortcuts', { defaultValue: 'Shortcuts' })} className="hidden lg:flex items-center gap-1 border-s border-slate-900/[0.08] dark:border-white/[0.08] ps-3">
            {shortcuts.map(({ tab, icon: Icon, label, title }) => (
              <button
                key={tab}
                type="button"
                onClick={() => React.startTransition(() => setActiveTab(tab))}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white transition-colors"
                title={title}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
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

        <div className="hidden xl:block">
          <WeatherWidget location={weatherLocation} />
        </div>

        <div className="hidden lg:block">
          <LanguageSwitcher compact />
        </div>

        {/* On phones, dark mode and settings live in the menu drawer to keep the bar uncluttered. */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={cn(ICON_BUTTON, 'hidden sm:flex')}
          title={darkMode ? t('theme_switch_light', { defaultValue: 'Switch to light mode' }) : t('theme_switch_dark', { defaultValue: 'Switch to dark mode' })}
          aria-label={darkMode ? t('theme_switch_light', { defaultValue: 'Switch to light mode' }) : t('theme_switch_dark', { defaultValue: 'Switch to dark mode' })}
        >
          {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={() => setIsNotificationPanelOpen(true)}
          className={cn(ICON_BUTTON, 'relative')}
          aria-label={t('header_open_notifications', { defaultValue: 'Open notifications' })}
        >
          <Bell className="w-5 h-5" />
          {apiUnreadCount > 0 && (
            <span className="absolute top-2 end-2 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#0d1a14]" aria-hidden="true" />
          )}
        </button>
        <button
          onClick={() => setShowSettingsPanel(true)}
          className={cn(ICON_BUTTON, 'hidden sm:flex')}
          aria-label={t('header_open_settings', { defaultValue: 'Open settings' })}
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="ms-1 ps-2 sm:ps-3 sm:border-s border-slate-900/[0.08] dark:border-white/[0.08]">
        <ProfileMenu
          isProfileMenuOpen={isProfileMenuOpen}
          setIsProfileMenuOpen={setIsProfileMenuOpen}
          storeUser={storeUser}
          setShowProfileModal={setShowProfileModal}
          handleLogout={handleLogout}
        />
        </div>
      </div>
    </header>
  );
};
