import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle } from 'lucide-react';
import { NavItem } from '../../config/navItems';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { sidebarVariants } from '@/lib/animations';

interface AppSidebarProps {
    sidebarOpen: boolean;
    navItems: NavItem[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    setShowHelpCenter: (show: boolean) => void;
    onGenerateReport: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    sidebarOpen,
    navItems,
    activeTab,
    setActiveTab,
    setShowHelpCenter,
    onGenerateReport,
}) => {
    const { isModern, subtextClass, headingClass } = useThemeClasses();
    const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

    return (
        <AnimatePresence>
            {sidebarOpen && (
                <>
                {/* Backdrop for mobile */}
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
                <motion.aside
                    variants={sidebarVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className={cn(
                        'fixed left-0 top-16 h-[calc(100vh-4rem)] flex flex-col pt-4 pb-8 px-4 border-r border-gray-200 dark:border-white/10 w-64 z-40',
                        isModern
                            ? 'bg-white/70 dark:bg-slate-950/40 backdrop-blur-2xl'
                            : 'bg-white dark:bg-slate-900 shadow-xl'
                    )}
                >
                    <div className="px-4 mb-8">
                    </div>

                    <nav className="flex flex-col gap-2 grow overflow-y-auto custom-scrollbar pr-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => React.startTransition(() => setActiveTab(item.id))}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 transition-all duration-200 text-left',
                                    isModern
                                        ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98]'
                                        : 'rounded-none border border-slate-300 dark:border-slate-700 font-mono text-[10px] uppercase tracking-widest',
                                    activeTab === item.id
                                        ? 'bg-primary-600/10 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-r-2 border-primary-600 dark:border-primary-400 shadow-[inset_0_0_15px_rgba(var(--color-primary-400-rgb),0.1)]'
                                        : cn(subtextClass, 'hover:bg-black/5 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-200')
                                )}
                            >
                                <item.icon className="w-4 h-4 flex-shrink-0" />
                                <span className="font-headline font-bold uppercase tracking-widest text-[10px]">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto flex flex-col gap-2 pt-6 border-t border-white/5">
                        <button
                            onClick={onGenerateReport}
                            className={cn(
                                'bg-primary-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 transition-all',
                                isModern ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98]' : 'rounded-none'
                            )}
                        >
                            <FileText className="w-3 h-3" />
                            <span className={headingClass}>Generate Report</span>
                        </button>
                        <button
                            onClick={() => setShowHelpCenter(true)}
                            className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-200 text-[10px] uppercase font-bold tracking-widest"
                        >
                            <HelpCircle className="w-3 h-3" />
                            Support
                        </button>
                    </div>
                </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};
