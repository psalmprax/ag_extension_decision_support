import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, Lock } from 'lucide-react';
import { NavItem } from '../../config/navItems';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { sidebarVariants } from '@/lib/animations';

interface AppSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen?: (open: boolean) => void;
  navItems: NavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setShowHelpCenter: (show: boolean) => void;
  onGenerateReport: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  navItems,
  activeTab,
  setActiveTab,
  setShowHelpCenter,
  onGenerateReport,
}) => {
  const { user } = useAppStore();
  const { subtextClass, headingClass } = useThemeClasses();

  const isFreeUser =
    user?.role !== 'admin' &&
    (user?.isFree || user?.planName?.toLowerCase() === 'free' || !user?.planName);

  const handleNavClick = (id: string) => {
    React.startTransition(() => setActiveTab(id));
    if (window.innerWidth < 768 && setSidebarOpen) {
      setSidebarOpen(false);
    }
  };

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
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          />

          <motion.aside
            variants={sidebarVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'fixed left-0 top-0 h-full flex flex-col pt-20 pb-8 px-4 border-r border-gray-200 dark:border-white/10 w-72 z-40',
              'bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl'
            )}
          >
            <div className="px-4 mb-4"></div>

            <nav className="flex flex-col gap-2 grow overflow-y-auto custom-scrollbar pr-2">
              {navItems.map(item => {
                const isLocked = isFreeUser && item.requiresPro;

                return (
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
                            'hover:bg-black/5 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-200'
                          )
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-headline font-bold uppercase tracking-widest text-xs truncate">
                        {item.label}
                      </span>
                    </div>

                    {isLocked && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0 ml-2">
                        <Lock className="w-2.5 h-2.5" />
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

          <div className="mt-auto flex flex-col gap-2 pt-6 border-t border-white/5">
            <button
              onClick={onGenerateReport}
              className={cn(
                'bg-primary-500 text-white px-4 py-3 min-h-[48px] flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 transition-all',
                'rounded-xl hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              <FileText className="w-4 h-4" />
              <span className={headingClass}>Generate Report</span>
            </button>
            <button
              onClick={() => setShowHelpCenter(true)}
              className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-200 text-xs uppercase font-bold tracking-widest"
            >
              <HelpCircle className="w-4 h-4" />
              Support
            </button>
          </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
