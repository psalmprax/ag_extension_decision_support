import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { NavItem } from '../../config/navItems';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { cn } from '@/lib/cn';
import { sidebarVariants } from '@/lib/animations';
import { triggerHaptic } from '@/lib/haptics';

import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { ABTestToggle } from '../ABTestToggle';

const NAV_SECTIONS = [
  {
    id: 'work',
    label: 'Field work',
    itemIds: [
      'dashboard',
      'farmer_dashboard',
      'aiassistant',
      'farmerchat',
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

interface AppSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen?: (open: boolean) => void;
  navItems: NavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setShowHelpCenter: (show: boolean) => void;
  onGenerateReport?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  navItems,
  activeTab,
  setActiveTab,
  setShowHelpCenter,
  onGenerateReport: _onGenerateReport,
}) => {
  const { subtextClass } = useThemeClasses();
  const { t } = useLanguage();
  const { themeName, setThemeName } = useAppStore();
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
      items: navItems.filter(item => (section.itemIds as readonly string[]).includes(item.id)),
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
            className="md:hidden fixed top-16 inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm z-30"
          />

          <motion.aside
            variants={sidebarVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'fixed left-0 top-16 bottom-0 flex flex-col pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8 px-4 border-r border-slate-200 dark:border-white/10 w-72 z-40',
              'bg-white/98 dark:bg-slate-950/95 backdrop-blur-2xl'
            )}
          >

            <nav className="flex flex-col gap-2 grow overflow-y-auto custom-scrollbar pr-2">
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
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      <span>{sectionLabel}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                      />
                    </button>
                    <div
                      id={`sidebar-section-${section.id}`}
                      hidden={!isExpanded}
                      className="flex flex-col gap-1"
                    >
                      {section.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            'flex items-center justify-between px-4 py-3 min-h-[48px] transition-all duration-200 text-left group',
                            'rounded-xl hover:scale-[1.02] active:scale-[0.98]',
                            activeTab === item.id
                              ? 'bg-primary-600/10 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-r-2 border-primary-600 dark:border-primary-400 shadow-[inset_0_0_15px_var(--color-outline)]'
                              : cn(
                                  subtextClass,
                                  'hover:bg-slate-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-200'
                                )
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span
                              className="font-headline font-semibold tracking-wide text-xs whitespace-normal break-words leading-tight"
                              title={t(item.labelKey || `nav_${item.id}`, { defaultValue: item.label })}
                            >
                              {t(item.labelKey || `nav_${item.id}`, { defaultValue: item.label })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </nav>

          <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-white/5">
            {/* Mobile-visible Language, Theme & A/B Experiment controls */}
            <div className="lg:hidden flex flex-col gap-2 pb-2 border-b border-gray-100 dark:border-white/5">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                {t('common_preferences', { defaultValue: 'Preferences' })}
              </span>
              <div className="flex items-center justify-between gap-2">
                <LanguageSwitcher compact />
                <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
              </div>
              <div className="pt-1">
                <ABTestToggle />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpCenter(true)}
              className="flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 text-xs uppercase font-bold tracking-widest rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              {t('nav_support', { defaultValue: 'Support' })}
            </button>
          </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
