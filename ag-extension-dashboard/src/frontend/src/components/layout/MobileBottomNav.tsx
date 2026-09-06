import React from 'react';
import { LayoutDashboard, Users, Camera, BookOpen, Menu, Lock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { triggerHaptic } from '@/lib/haptics';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
}) => {
  const user = useAppStore(s => s.user);
  const { t } = useLanguage();
  const { designVariant } = useFeatureFlags();
  const isBase = designVariant === 'base' || designVariant === 'new';

  const isFreeUser =
    user?.role !== 'admin' &&
    (user?.isFree || user?.planName?.toLowerCase() === 'free' || !user?.planName);

  const handleTabClick = (id: string) => {
    triggerHaptic('light');
    setActiveTab(id);
  };

  const navItems = [
    {
      id: 'dashboard',
      label: t('nav_home', { defaultValue: 'Home' }),
      icon: LayoutDashboard,
      requiresPro: false,
    },
    {
      id: 'portfolio',
      label: t('nav_farmers', { defaultValue: 'Farmers' }),
      icon: Users,
      requiresPro: false,
    },
    {
      id: 'disease_diagnosis',
      label: t('nav_ai_scan', { defaultValue: 'AI Scan' }),
      icon: Camera,
      isSpecial: true,
      requiresPro: true,
    },
    {
      id: 'knowledge',
      label: t('nav_knowledge', { defaultValue: 'Knowledge' }),
      icon: BookOpen,
      requiresPro: false,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className={
        isBase
          ? 'md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 max-w-lg mx-auto z-40 bg-slate-950/85 dark:bg-black/90 backdrop-blur-2xl border border-white/15 rounded-2xl px-2 py-1.5 shadow-2xl shadow-black/80 transition-all duration-300 ring-1 ring-white/10'
          : 'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-white/10 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl transition-all'
      }
    >
      <div className="flex items-center justify-around max-w-lg mx-auto w-full">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const isLocked = isFreeUser && item.requiresPro;
          const Icon = item.icon;

          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`relative -top-3 flex flex-col items-center group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  isBase ? 'active:scale-90 transition-transform duration-150' : ''
                }`}
                aria-label={item.label}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 ${
                    isActive
                      ? isBase
                        ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 shadow-blue-500/40 scale-105 ring-2 ring-blue-400/50'
                        : 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/40 scale-105 ring-2 ring-emerald-400/50'
                      : isBase
                        ? 'bg-gradient-to-tr from-blue-600 to-blue-700 shadow-blue-900/40 hover:scale-105 active:scale-95'
                        : 'bg-gradient-to-tr from-emerald-600 to-emerald-500 shadow-emerald-900/30 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {isLocked && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-black shadow">
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-bold mt-1 tracking-tight ${
                    isActive ? (isBase ? 'text-blue-400' : 'text-emerald-400') : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex-1 flex flex-col items-center py-1 px-2 min-h-[48px] rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                isBase
                  ? isActive
                    ? 'bg-white/[0.08] text-white font-bold border border-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 active:scale-90 transition-transform duration-150'
                  : isActive
                    ? 'text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      isBase ? 'bg-blue-400 shadow-[0_0_6px_#38bdf8]' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </div>
              <span className="text-xs mt-1 font-medium tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Menu Drawer Trigger */}
        <button
          onClick={() => {
            triggerHaptic('light');
            setSidebarOpen(!sidebarOpen);
          }}
          className={`flex-1 flex flex-col items-center py-1 px-2 min-h-[48px] rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-200 ${
            isBase ? 'active:scale-90 transition-transform duration-150' : 'active:scale-95'
          }`}
          aria-label={t('nav_menu', { defaultValue: 'Toggle Full Menu' })}
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs mt-1 font-medium tracking-tight truncate max-w-[64px]">
            {t('nav_menu', { defaultValue: 'Menu' })}
          </span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
