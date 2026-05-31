import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    ChevronRight, 
    MessageSquare, 
    History,
    Search,
    Plus,
    Clock,
    User,
    LogOut,
    CheckCircle2,
    Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { logout as apiLogout } from '@/api/authService';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface HistoryItem {
    id: string;
    query?: string;
    queryText?: string;
    crop?: string;
    category?: string;
    timestamp?: string;
    createdAt?: string;
}

interface KnowledgeSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    history: HistoryItem[];
    onSelect: (h: HistoryItem) => void;
    onNewQuery?: () => void;
}

export const KnowledgeSidebar: React.FC<KnowledgeSidebarProps> = ({ 
    isOpen, 
    onToggle, 
    history,
    onSelect,
    onNewQuery
}) => {
    const { user } = useAppStore();
    const { isModern, radiusClass } = useThemeClasses();

    const handleLogout = async () => {
        await apiLogout();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div className={`relative h-full flex-shrink-0 transition-all duration-300 ease-in-out z-40 ${isOpen ? 'w-80' : 'w-0'}`}>
            <aside 
                className={`h-full w-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-hidden`}
            >
                <div className="h-full flex flex-col p-4 w-80">
                {/* New Search Button */}
                <button 
                    onClick={() => onNewQuery ? onNewQuery() : window.location.reload()}
                    className={`flex items-center gap-2 w-full p-4 mb-8 bg-primary-600 hover:bg-primary-700 text-white ${radiusClass} font-black text-sm uppercase tracking-widest shadow-lg shadow-primary-500/20 transition-all transform active:scale-95`}
                >
                    <Plus className="w-5 h-5" />
                    New Expert Query
                </button>

                {/* History Section */}
                <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
                    <div className="flex items-center gap-2 text-gray-400 px-2">
                        <History className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Recent Search Retainer</span>
                    </div>

                    <div className="space-y-2">
                        {history.length === 0 ? (
                            <div className="text-center py-8 px-4">
                                <Search className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                                <p className="text-xs font-bold text-gray-400">No recent queries found</p>
                            </div>
                        ) : (
                            history.map((h, i) => (
                                <motion.button
                                    key={h.id || i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x:0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => onSelect(h)}
                                    className={`w-full text-left p-4 ${radiusClass} hover:bg-gray-50 dark:hover:bg-gray-800 group transition-all border border-transparent hover:border-primary-500/10`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 bg-gray-100 dark:bg-gray-800 ${isModern ? 'rounded-xl' : 'rounded-none'} group-hover:bg-primary-500/10 group-hover:text-primary-500 transition-colors`}>
                                            <MessageSquare className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate mb-1">
                                                {h.queryText}
                                            </p>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                               {h.crop && (
                                                   <span className="flex items-center gap-1 text-primary-500">
                                                       <Target className="w-2.5 h-2.5" />
                                                       {h.crop}
                                                   </span>
                                               )}
                                               <span className="flex items-center gap-1">
                                                   <Clock className="w-2.5 h-2.5" />
                                                   {h.createdAt ? `${formatDistanceToNow(new Date(h.createdAt))} ago` : ''}
                                               </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.button>
                            ))
                        )}
                    </div>
                </div>

                {/* Sidebar Footer */}
                <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 px-2">
                    <div className={`w-10 h-10 bg-indigo-500 ${radiusClass} flex items-center justify-center text-white font-black`}>
                        {user ? (
                            <span className="text-sm font-bold">{user.firstName?.[0]}{user.lastName?.[0]}</span>
                        ) : (
                            <User className="w-6 h-6" />
                        )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {user ? `${user.firstName} ${user.lastName}` : 'User'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                            {user?.role?.replace('_', ' ') || 'Member'}
                        </p>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            </aside>

            {/* Toggle Tab */}
            <button 
                onClick={onToggle}
                className={`absolute top-1/2 -right-4 translate-y-[-50%] p-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full shadow-lg text-gray-400 hover:text-primary-500 transition-all z-50 group flex items-center justify-center ${!isOpen && 'translate-x-4'}`}
            >
                {isOpen ? (
                    <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />
                ) : (
                    <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" />
                )}
            </button>
        </div>
    );
};
