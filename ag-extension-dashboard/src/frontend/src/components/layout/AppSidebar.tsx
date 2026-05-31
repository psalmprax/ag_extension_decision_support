import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle } from 'lucide-react';
import { NavItem } from '../../config/navItems';

interface AppSidebarProps {
    sidebarOpen: boolean;
    navItems: NavItem[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    setShowHelpCenter: (show: boolean) => void;
    storeUser: { region?: string } | null;
    isModern: boolean;
    darkMode: boolean;
    subtextClass: string;
    headingClass: string;
    btnClass: string;
    onGenerateReport: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    sidebarOpen,
    navItems,
    activeTab,
    setActiveTab,
    setShowHelpCenter,
    storeUser,
    isModern,
    subtextClass,
    headingClass,
    btnClass,
    onGenerateReport,
}) => {
    return (
        <AnimatePresence>
            {sidebarOpen && (
                <motion.aside
                    initial={{ width: 0, opacity: 0, x: -20 }}
                    animate={{ width: 256, opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: -20 }}
                    className={`fixed left-0 top-0 h-full flex flex-col pt-20 pb-8 px-4 ${isModern ? 'bg-white/70 dark:bg-slate-950/40 backdrop-blur-2xl' : 'bg-white dark:bg-slate-900 shadow-xl'} border-r border-gray-200 dark:border-white/10 w-64 z-40`}
                >
                    <div className="px-4 mb-8">
                        <h3 className={`font-headline text-sm tracking-widest uppercase mb-1 ${isModern ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-400'}`}>Ag-Extension</h3>
                        <p className={`text-[10px] font-medium ${subtextClass}`}>{storeUser?.region || 'Sector 7G - Midwest'}</p>
                    </div>

                    <nav className="flex flex-col gap-2 grow overflow-y-auto custom-scrollbar pr-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => React.startTransition(() => setActiveTab(item.id))}
                                className={`flex items-center gap-3 px-4 py-3 ${btnClass} transition-all duration-200 text-left ${activeTab === item.id
                                    ? 'bg-cyan-600/10 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-r-2 border-cyan-600 dark:border-cyan-400 shadow-[inset_0_0_15px_rgba(0,245,255,0.1)]'
                                    : `${subtextClass} hover:bg-black/5 dark:hover:bg-white/5 hover:text-cyan-600 dark:hover:text-cyan-200`
                                    }`}
                            >
                                <item.icon className="w-4 h-4 flex-shrink-0" />
                                <span className="font-headline font-bold uppercase tracking-widest text-[10px]">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto flex flex-col gap-2 pt-6 border-t border-white/5">
                        <button
                            onClick={onGenerateReport}
                            className={`bg-cyan-500 text-white px-4 py-3 ${btnClass} flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all`}
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
            )}
        </AnimatePresence>
    );
};
