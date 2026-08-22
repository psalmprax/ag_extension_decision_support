import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
  Clock,
  Loader2,
  Undo,
  Radio,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  Notification as ApiNotification,
} from '@/api/notificationService';
import toast from 'react-hot-toast';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DisplayNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

const NOTIFICATION_ICONS = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  error: <AlertCircle className="w-4 h-4 text-rose-400" />,
  info: <Info className="w-4 h-4 text-sky-400" />,
};

const NOTIFICATION_BG = {
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  error: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  info: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
};

const NotificationItem: React.FC<{
  notification: DisplayNotification;
  onMarkRead: (id: string) => void;
}> = ({ notification, onMarkRead }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`p-3.5 rounded-[4px] border transition-all relative group cursor-pointer ${
      notification.read
        ? 'bg-slate-900/40 border-slate-800/80 opacity-60 hover:opacity-100 hover:border-slate-700'
        : `${NOTIFICATION_BG[notification.type]} shadow-lg shadow-black/40`
    }`}
    onClick={() => onMarkRead(notification.id)}
  >
    <div className="flex gap-3 items-start">
      <div className="shrink-0 mt-0.5 p-1 rounded bg-slate-950/60 border border-white/10">
        {NOTIFICATION_ICONS[notification.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs leading-relaxed ${
            notification.read ? 'text-slate-400' : 'text-slate-100 font-medium'
          }`}
        >
          {notification.message}
        </p>
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono tracking-wider">
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
          </div>
          {notification.actionLabel && notification.onAction && (
            <button
              onClick={e => {
                e.stopPropagation();
                notification.onAction?.();
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] font-bold text-emerald-300 rounded-[3px] transition-all border border-emerald-500/40"
            >
              <Undo className="w-2.5 h-2.5" />
              {notification.actionLabel}
            </button>
          )}
        </div>
      </div>
      {!notification.read && (
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0 mt-1 animate-pulse" />
      )}
    </div>
  </motion.div>
);

const NotificationEmptyState: React.FC<{ t: (k: string) => string }> = ({ t }) => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded flex items-center justify-center text-slate-500">
      <Bell className="w-6 h-6" />
    </div>
    <div>
      <p className="text-xs font-bold text-slate-300">
        {t('common_no_data') || 'No new notifications'}
      </p>
      <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
        {t('notifications_all_caught_up') || 'System telemetry all caught up'}
      </p>
    </div>
  </div>
);

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  const {
    notifications: storeNotifications,
    markNotificationRead: storeMarkRead,
    clearNotifications: storeClear,
  } = useAppStore();
  const { t } = useLanguage();
  const [apiNotifications, setApiNotifications] = useState<ApiNotification[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [useApiData, setUseApiData] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all');

  useEffect(() => {
    if (isOpen) {
      setIsLoadingApi(true);
      fetchNotifications()
        .then(data => {
          setApiNotifications(data);
          setUseApiData(true);
        })
        .catch(() => {
          setUseApiData(false);
        })
        .finally(() => setIsLoadingApi(false));
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    if (useApiData) {
      try {
        await markAsRead(id);
        setApiNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
      } catch {
        storeMarkRead(id);
      }
    } else {
      storeMarkRead(id);
    }
  };

  const handleMarkAllRead = async () => {
    if (useApiData) {
      try {
        await markAllAsRead();
        setApiNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        toast.success('All notifications marked as read');
      } catch {
        toast.error('Failed to mark all as read');
      }
    } else {
      storeClear();
    }
  };

  const handleClearAll = async () => {
    if (useApiData) {
      try {
        await clearAllNotifications();
        setApiNotifications([]);
        toast.success('All notifications cleared');
      } catch {
        toast.error('Failed to clear notifications');
      }
    } else {
      storeClear();
    }
  };

  const rawNotifications: DisplayNotification[] = useApiData
    ? apiNotifications.map(n => ({
        id: n.id,
        type: (n.type as 'success' | 'warning' | 'error' | 'info') || 'info',
        message: n.title ? `${n.title}: ${n.message}` : n.message,
        timestamp: new Date(n.createdAt).getTime(),
        read: n.isRead,
      }))
    : (storeNotifications as DisplayNotification[]);

  const filteredNotifications = rawNotifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.type === 'error' || n.type === 'warning';
    return true;
  });

  const unreadCount = rawNotifications.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-slate-950/95 border-l border-emerald-500/30 shadow-2xl shadow-emerald-950/60 z-[70] flex flex-col backdrop-blur-2xl text-slate-100"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[4px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-black tracking-wide text-white uppercase">
                      {t('nav_notifications') || 'Notifications'}
                    </h2>
                    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-[3px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                      <Radio className="w-2.5 h-2.5 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    {unreadCount} {t('common_unread') || 'Unread'} · {rawNotifications.length} Total
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {rawNotifications.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllRead}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                      title={t('common_mark_all_read') || 'Mark All Read'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                      title={t('common_clear_all') || 'Clear All'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Filter Pill Switcher */}
            <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-1.5 text-[11px]">
              {(['all', 'unread', 'alerts'] as const).map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => setFilter(tabKey)}
                  className={`px-2.5 py-1 rounded-[3px] font-bold uppercase text-[10px] tracking-wider transition-all ${
                    filter === tabKey
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tabKey}
                </button>
              ))}
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {isLoadingApi ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <NotificationEmptyState t={t} />
              ) : (
                filteredNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/60">
              <button
                onClick={() => {
                  onClose();
                  useAppStore.getState().setActiveTab('analytics');
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded border border-slate-800 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <span>{t('notifications_view_history') || 'View Activity Telemetry'} &rarr;</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
