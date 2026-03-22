import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle2, AlertTriangle, AlertCircle, Info, Trash2, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
    const { notifications, markNotificationRead, clearNotifications } = useAppStore();
    const { t } = useLanguage();

    const icons = {
        success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        error: <AlertCircle className="w-5 h-5 text-rose-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const bgColors = {
        success: 'bg-emerald-50 dark:bg-emerald-900/10',
        warning: 'bg-amber-50 dark:bg-amber-900/10',
        error: 'bg-rose-50 dark:bg-rose-900/10',
        info: 'bg-blue-50 dark:bg-blue-900/10',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-theme-bg-card border-l border-gray-200 dark:border-gray-800 shadow-2xl z-[70] flex flex-col"
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                                    <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">{t('nav_notifications') || 'Notifications'}</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{notifications.length} {t('common_total') || 'Total'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && (
                                    <button
                                        onClick={clearNotifications}
                                        className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                                        title={t('common_clear_all') || 'Clear All'}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar overflow-x-hidden">
                            {notifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-700">
                                        <Bell className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('common_no_data') || 'No new notifications'}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">{t('notifications_all_caught_up') || 'You are all caught up'}</p>
                                    </div>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <motion.div
                                        key={notification.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-4 rounded-2xl border transition-all relative group cursor-pointer ${notification.read
                                            ? 'bg-transparent border-gray-100 dark:border-gray-800 opacity-60'
                                            : `${bgColors[notification.type]} border-white/20 dark:border-white/5 shadow-sm`
                                            }`}
                                        onClick={() => markNotificationRead(notification.id)}
                                    >
                                        <div className="flex gap-4">
                                            <div className="shrink-0 mt-1">
                                                {icons[notification.type]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm leading-relaxed ${notification.read ? 'text-gray-500' : 'text-gray-900 dark:text-white font-medium'}`}>
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Clock className="w-3 h-3 text-gray-400" />
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                            {!notification.read && (
                                                <div className="w-2 h-2 bg-primary-500 rounded-full absolute top-4 right-4 animate-pulse" />
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-800">
                             <button className="w-full py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl transition-all uppercase tracking-widest border border-gray-100 dark:border-gray-700">
                                {t('notifications_view_history') || 'View All Activity'}
                             </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
