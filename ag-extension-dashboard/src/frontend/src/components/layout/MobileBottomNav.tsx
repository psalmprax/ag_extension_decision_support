import React from 'react';
import {
  LayoutDashboard,
  Users,
  Camera,
  BookOpen,
  Menu,
  Lock,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';

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
  const { isModern } = useThemeClasses();

  const isFreeUser =
    user?.role !== 'admin' &&
    (user?.isFree || user?.planName?.toLowerCase() === 'free' || !user?.planName);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      requiresPro: false,
    },
    {
      id: 'portfolio',
      label: 'Farmers',
      icon: Users,
      requiresPro: false,
    },
    {
      id: 'disease_diagnosis',
      label: 'AI Scan',
      icon: Camera,
      isSpecial: true,
      requiresPro: true,
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      icon: BookOpen,
      requiresPro: false,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-white/10 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl transition-all"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const isLocked = isFreeUser && item.requiresPro;
          const Icon = item.icon;

          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative -top-3 flex flex-col items-center group cursor-pointer focus:outline-none"
                aria-label={item.label}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/40 scale-105 ring-2 ring-emerald-400/50'
                      : 'bg-gradient-to-tr from-emerald-600 to-emerald-500 shadow-emerald-900/30 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {isLocked && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[9px] font-black shadow">
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold mt-1 tracking-tight ${
                    isActive ? 'text-emerald-400' : 'text-slate-400'
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
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer focus:outline-none ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Menu Drawer Trigger */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`flex-1 flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-200 active:scale-95 ${
            isModern ? '' : 'font-mono'
          }`}
          aria-label="Toggle Full Menu"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
