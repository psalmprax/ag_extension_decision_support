import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  Edit,
  Trash2,
  Share2,
  Download,
  Calendar,
  History,
  RefreshCcw,
  FileText,
  CheckSquare,
  Square,
  Globe,
  Key,
  UserCheck,
  UserX,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { fetchContextMenu, getUnavailableMenu, getDefaultContextMenu } from '@/api/contextMenuService';

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: string;
  separator?: boolean;
}

interface ContextMenuSection {
  id: string;
  title?: string;
  items: ContextMenuItem[];
}

interface ContextMenuData {
  entityType: string;
  entityId?: string;
  sections: ContextMenuSection[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user' | 'stat';
  entityId?: string;
  isBulk?: boolean;
  onClose: () => void;
  onAction: (action: string, entityId?: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  eye: Eye,
  edit: Edit,
  trash: Trash2,
  share: Share2,
  download: Download,
  calendar: Calendar,
  history: History,
  refresh: RefreshCcw,
  note: FileText,
  'user-cog': UserCheck,
  'user-x': UserX,
  key: Key,
  globe: Globe,
  'check-square': CheckSquare,
  square: Square,
  'x-circle': XCircle,
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  entityType,
  entityId,
  isBulk = false,
  onClose,
  onAction,
}) => {
  const [menuData, setMenuData] = useState<ContextMenuData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const result = await fetchContextMenu(entityType, entityId, isBulk);
        if (result.success && result.data) {
          setMenuData(result.data);
        } else {
          setMenuData(getDefaultContextMenu(entityType, entityId, isBulk));
        }
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code !== 'ERR_DEMO_BLOCKED') {
          console.warn('Failed to fetch context menu, falling back to default:', error);
        }
        setMenuData(getDefaultContextMenu(entityType, entityId, isBulk));
      } finally {
        setIsLoading(false);
      }
    };

    loadMenu();
  }, [entityType, entityId, isBulk]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position to keep menu inside viewport
  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="fixed z-[9999] w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden py-2"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {isLoading ? (
          <div className="px-4 py-8 flex justify-center">
            <RefreshCcw className="w-5 h-5 text-primary-500 animate-spin" />
          </div>
        ) : menuData?.sections.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500 italic">No actions available</div>
        ) : (
          menuData?.sections.map(section => (
            <div
              key={section.id}
              className="last:border-b-0 border-b border-gray-100 dark:border-gray-800 pb-1 last:pb-0"
            >
              {section.title && (
                <div className="px-4 py-1.5 text-xxs font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 dark:bg-gray-800/50 mb-1">
                  {section.title}
                </div>
              )}
              {section.items.map(item => {
                if (item.separator) {
                  return (
                    <div key={item.id} className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />
                  );
                }

                const Icon = item.icon && iconMap[item.icon] ? iconMap[item.icon] : MoreVertical;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onAction(item.action, entityId);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors text-left
                      ${
                        item.action.includes('delete')
                          ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400'
                      }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </motion.div>
    </AnimatePresence>
  );
};
