import React from 'react';
import { LayoutDashboard, Users, Camera, BookOpen, Menu, Lock, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { triggerHaptic } from '@/lib/haptics';
import { isMenuItemLocked, type PaidService } from '@/lib/planAccess';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  isSpecial?: boolean;
  requiresPro?: boolean;
  service?: PaidService;
}

const TAB_BUTTON =
  'flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';
const tabTone = (isActive: boolean) =>
  isActive
    ? 'text-emerald-800 dark:text-emerald-200'
    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';

/** The scan tab: same row height as the others, with a filled icon well. */
const SpecialCenterButton: React.FC<{
  item: NavItemConfig;
  isActive: boolean;
  isLocked: boolean;
  onClick: () => void;
}> = ({ item, isActive, isLocked, onClick }) => {
  const Icon = item.icon;
  return (
    <button onClick={onClick} className={`${TAB_BUTTON} ${tabTone(isActive)}`} aria-label={item.label} aria-current={isActive ? 'page' : undefined}>
      <span className="relative w-10 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center">
        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
        {isLocked && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="text-xs truncate max-w-[72px]">{item.label}</span>
    </button>
  );
};

const StandardNavButton: React.FC<{
  item: NavItemConfig;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <button onClick={onClick} className={`${TAB_BUTTON} ${tabTone(isActive)}`} aria-current={isActive ? 'page' : undefined}>
      <span className={`w-10 h-7 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-50 dark:bg-emerald-400/[0.12]' : ''}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <span className={`text-xs truncate max-w-[72px] ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
    </button>
  );
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
}) => {
  const user = useAppStore(s => s.user);
  const { t } = useLanguage();


  const handleTabClick = (id: string) => {
    triggerHaptic('light');
    setActiveTab(id);
  };

  // Farmers get their own tabs; the officers' ones would bounce back to their menu.
  const farmerItems: NavItemConfig[] = [
    { id: 'farmer_dashboard', label: t('nav_home', { defaultValue: 'Home' }), icon: LayoutDashboard },
    { id: 'officerchat', label: t('nav_officerchat', { defaultValue: 'My officer' }), icon: MessageSquare, requiresPro: true, service: 'chat' },
    { id: 'knowledge', label: t('nav_knowledge', { defaultValue: 'Knowledge' }), icon: BookOpen },
  ];

  const officerItems: NavItemConfig[] = [
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
      label: t('nav_ai_scan', { defaultValue: 'AI scan' }),
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
  const navItems = user?.role === 'farmer' ? farmerItems : officerItems;

  const navClass =
    'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0d1a14] border-t border-slate-900/[0.08] dark:border-white/[0.08] px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]';

  return (
    <nav aria-label={t('nav_mobile_bar', { defaultValue: 'Main' })} className={navClass}>
      <div className="flex items-center justify-around max-w-lg mx-auto w-full">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const isLocked = isMenuItemLocked(user, item);

          return item.isSpecial ? (
            <SpecialCenterButton
              key={item.id}
              item={item}
              isActive={isActive}
              isLocked={Boolean(isLocked)}
              onClick={() => handleTabClick(item.id)}
            />
          ) : (
            <StandardNavButton
              key={item.id}
              item={item}
              isActive={isActive}
              onClick={() => handleTabClick(item.id)}
            />
          );
        })}

        <button
          onClick={() => {
            triggerHaptic('light');
            setSidebarOpen(!sidebarOpen);
          }}
          className={`${TAB_BUTTON} ${tabTone(sidebarOpen)}`}
          aria-label={t('nav_menu', { defaultValue: 'Menu' })}
          aria-expanded={sidebarOpen}
        >
          <span className="w-10 h-7 flex items-center justify-center">
            <Menu className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="text-xs">{t('nav_menu', { defaultValue: 'Menu' })}</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
