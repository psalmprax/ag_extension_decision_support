import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { triggerHaptic } from '@/lib/haptics';
import { useFeatureFlags } from '@/store/useFeatureFlags';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconBg = 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
  maxWidth = 'max-w-lg',
  children,
  footer,
  showCloseButton = true,
}) => {
  const { btnClass } = useThemeClasses();
  const { designVariant } = useFeatureFlags();
  const isBase = designVariant === 'base' || designVariant === 'new';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-[9999] ${
            isBase
              ? 'flex items-end sm:items-center justify-center p-0 sm:p-4'
              : 'flex items-center justify-center p-3 sm:p-4'
          }`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />
          <motion.div
            initial={
              isBase
                ? { opacity: 0, y: 60 }
                : { opacity: 0, scale: 0.95, y: 15 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              isBase
                ? { opacity: 0, y: 60 }
                : { opacity: 0, scale: 0.95, y: 15 }
            }
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`relative w-full ${maxWidth} max-h-[92dvh] sm:max-h-[85vh] bg-slate-950/95 dark:bg-slate-950/95 overflow-hidden flex flex-col backdrop-blur-2xl ${
              isBase
                ? 'border-t sm:border border-blue-500/30 ring-1 ring-blue-500/20 rounded-t-[28px] sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-[0_-10px_40px_rgba(0,82,255,0.15)] sm:shadow-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-0'
                : 'border border-emerald-500/30 rounded-xl shadow-2xl'
            }`}
            style={!isBase ? { borderRadius: 'var(--radius-card, 0.75rem)' } : undefined}
          >
            {/* KnockKnock Ambient Mesh Gradient Orb */}
            <div
              className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[90px] pointer-events-none ${
                isBase ? 'bg-blue-600/15' : 'bg-emerald-500/15'
              }`}
            />
            <div
              className={`absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-[90px] pointer-events-none ${
                isBase ? 'bg-indigo-600/10' : 'bg-teal-500/10'
              }`}
            />

            {/* Drag Handle on Mobile for Variant B */}
            {isBase && (
              <div className="pt-3 pb-1 flex justify-center sm:hidden relative z-20">
                <div className="w-12 h-1.5 bg-white/25 rounded-full hover:bg-white/40 transition-colors" />
              </div>
            )}

            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-3.5">
                  {icon && (
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${
                        isBase && iconBg.includes('emerald')
                          ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                          : iconBg
                      } flex items-center justify-center shadow-inner shrink-0`}
                    >
                      {icon}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                      {title}
                    </h3>
                    {subtitle && (
                      <p
                        className={`text-xxs font-black uppercase tracking-widest mt-0.5 ${
                          isBase ? 'text-blue-400' : 'text-emerald-400'
                        }`}
                      >
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
                {showCloseButton && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      onClose();
                    }}
                    className={`p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 ${btnClass} transition-colors rounded-xl active:scale-95`}
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10 text-slate-300 text-sm leading-relaxed">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 sm:p-6 border-t border-slate-800/80 bg-slate-900/40 relative z-10">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BaseModal;
