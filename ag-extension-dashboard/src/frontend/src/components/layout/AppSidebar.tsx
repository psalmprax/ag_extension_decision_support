import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Lock, Moon, Settings, Sun } from 'lucide-react';
import { NavItem } from '../../config/navItems';
import { UnreadCount } from '@/components/chat/UnreadCount';
import { collapseHubs, menuItemIsActive } from '@/config/navHubs';
import { cn } from '@/lib/cn';
import { sheetVariants, sidebarVariants } from '@/lib/animations';
import { useIsPhone } from '@/hooks/useIsPhone';
import { triggerHaptic } from '@/lib/haptics';

import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { isMenuItemLocked } from '@/lib/planAccess';

/** Menu items that carry the unread-messages badge. */
const CHAT_TABS = new Set(['farmerchat', 'officerchat']);

const NAV_SECTIONS = [
  {
    id: 'work',
    label: 'Field work',
    itemIds: [
      'dashboard',
      'farmer_dashboard',
      'aiassistant',
      'farmerchat',
      'officerchat',
      'knowledge',
      'portfolio',
      'visits',
      'fields',
      'disease_diagnosis',
      'advisory_studio',
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    itemIds: ['reports', 'analytics', 'worldmonitor'],
  },
  {
    id: 'operations',
    label: 'Operations',
    itemIds: ['sms', 'billing', 'email_workflows'],
  },
  {
    id: 'administration',
    label: 'Administration',
    itemIds: ['telemetry', 'agents', 'system_health', 'memory', 'mcp_tools', 'user_management'],
  },
] as const;

const getSectionId = (itemId: string) =>
  NAV_SECTIONS.find(section => (section.itemIds as readonly string[]).includes(itemId))?.id ?? 'other';

const DRAWER_BUTTON =
  'flex items-center justify-center gap-2 h-11 rounded-md border border-slate-900/[0.1] dark:border-white/[0.12] text-sm text-slate-700 dark:text-slate-200';

interface AppSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen?: (open: boolean) => void;
  navItems: NavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setShowHelpCenter: (show: boolean) => void;
  /** Opens the settings panel; shown in the drawer on phones, where the header hides it. */
  onOpenSettings?: () => void;
  onGenerateReport?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  navItems,
  activeTab,
  setActiveTab,
  setShowHelpCenter,
  onOpenSettings,
  onGenerateReport: _onGenerateReport,
}) => {
  const { t } = useLanguage();
  const isPhone = useIsPhone();
  const { themeName, setThemeName, user, darkMode, setDarkMode } = useAppStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({
    [getSectionId(activeTab)]: true,
  }));

  useEffect(() => {
    const activeSection = getSectionId(activeTab);
    setExpandedSections(current => ({ ...current, [activeSection]: true }));
  }, [activeTab]);

  const handleNavClick = (id: string) => {
    triggerHaptic('light');
    React.startTransition(() => setActiveTab(id));
    if (window.innerWidth < 768 && setSidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const sections: Array<{ id: string; label: string; itemIds: readonly string[]; items: NavItem[] }> =
    NAV_SECTIONS.map(section => ({
      ...section,
      items: collapseHubs(navItems).filter(item => (section.itemIds as readonly string[]).includes(item.id)),
    })).filter(section => section.items.length > 0);
  const ungroupedItems = navItems.filter(item => getSectionId(item.id) === 'other');
  if (ungroupedItems.length > 0) {
    sections.push({ id: 'other', label: 'Other', itemIds: [], items: ungroupedItems });
  }

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen?.(false)}
            className="md:hidden fixed inset-0 bg-black/30 z-[1100]"
          />

          {/* Phones: the menu is a sheet that rises from the bottom, with a grabber. */}
          <motion.aside
            variants={isPhone ? sheetVariants : sidebarVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            drag={isPhone ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_event, info) => {
              if (info.offset.y > 120) setSidebarOpen?.(false);
            }}
            className={cn(
              'fixed flex flex-col px-3',
              isPhone
                ? 'inset-x-0 bottom-0 max-h-[86dvh] rounded-t-[28px] ios-sheet pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] z-[1101]'
                : 'start-0 top-16 bottom-0 pt-3 pb-4 border-e border-slate-900/[0.08] dark:border-white/[0.08] w-64 z-40 bg-white dark:bg-[#0d1a14]'
            )}
          >
            {isPhone && <span className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-900/20 dark:bg-white/25" aria-hidden="true" />}

            <nav className="flex flex-col gap-3 grow overflow-y-auto custom-scrollbar -me-1 pe-1">
              {sections.map(section => {
                const isExpanded = Boolean(expandedSections[section.id]);
                const sectionLabel = t(`sidebar_group_${section.id}`, { defaultValue: section.label });
                return (
                  <section key={section.id}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`sidebar-section-${section.id}`}
                      onClick={() =>
                        setExpandedSections(current => ({ ...current, [section.id]: !current[section.id] }))
                      }
                      className="flex w-full items-center justify-between px-3 py-1.5 text-start text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md"
                    >
                      <span>{sectionLabel}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                      />
                    </button>
                    <div
                      id={`sidebar-section-${section.id}`}
                      className="flex flex-col gap-0.5"
                      style={{ display: isExpanded ? 'flex' : 'none' }}
                    >
                      {section.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 min-h-[44px] md:min-h-[40px] transition-colors text-start rounded-md',
                            menuItemIsActive(item, activeTab, navItems)
                              ? 'bg-emerald-50 dark:bg-emerald-400/[0.1] text-emerald-800 dark:text-emerald-200 font-medium'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <item.icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
                            <span
                              className="text-sm whitespace-normal break-words hyphens-auto leading-snug"
                              title={t(item.labelKey || `nav_${item.id}`, { defaultValue: item.label })}
                            >
                              {t(item.labelKey || `nav_${item.id}`, { defaultValue: item.label })}
                            </span>
                          </div>
                          {CHAT_TABS.has(item.id) && <UnreadCount className="ms-2" />}
                          {isMenuItemLocked(user, item) && (
                            <Lock
                              className="w-3.5 h-3.5 text-amber-500/80 dark:text-amber-400/80 shrink-0"
                              aria-label={t('plan_pro_locked', { defaultValue: 'Pro plan required' })}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </nav>

          <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
            {/* Mobile-visible Language, Theme & A/B Experiment controls */}
            <div className="lg:hidden flex flex-col gap-2 pb-2 border-b border-gray-100 dark:border-white/5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('common_preferences', { defaultValue: 'Preferences' })}
              </span>
              <div className="flex items-center justify-between gap-2">
                <LanguageSwitcher compact />
                <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
              </div>
              <div className="sm:hidden grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDarkMode(!darkMode)} className={DRAWER_BUTTON}>
                  {darkMode ? <Sun className="w-[18px] h-[18px]" aria-hidden="true" /> : <Moon className="w-[18px] h-[18px]" aria-hidden="true" />}
                  {darkMode ? t('theme_light_short', { defaultValue: 'Light mode' }) : t('theme_dark_short', { defaultValue: 'Dark mode' })}
                </button>
                {onOpenSettings && (
                  <button type="button" onClick={() => { setSidebarOpen?.(false); onOpenSettings(); }} className={DRAWER_BUTTON}>
                    <Settings className="w-[18px] h-[18px]" aria-hidden="true" />
                    {t('header_open_settings_short', { defaultValue: 'Settings' })}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpCenter(true)}
              className="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm rounded-md hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05] transition-colors"
            >
              <HelpCircle className="w-[18px] h-[18px]" aria-hidden="true" />
              {t('nav_support', { defaultValue: 'Support' })}
            </button>
          </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
