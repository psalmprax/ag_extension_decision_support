import React from 'react';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { BaseModal } from './BaseModal';
import { triggerHaptic } from '@/lib/haptics';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
}) => {
  const { radiusClass } = useThemeClasses();
  const variants = {
    danger: {
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/15 border border-rose-500/30 text-rose-400',
      confirmBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50',
    },
    warning: {
      icon: AlertCircle,
      iconBg: 'bg-amber-500/15 border border-amber-500/30 text-amber-400',
      confirmBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50',
    },
    info: {
      icon: Info,
      iconBg: 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400',
      confirmBg: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50',
    },
    success: {
      icon: CheckCircle,
      iconBg: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
      confirmBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50',
    },
  };

  const config = variants[variant];
  const Icon = config.icon;

  const footer = (
    <div className="flex gap-3">
      <button
        onClick={() => {
          triggerHaptic('light');
          onClose();
        }}
        disabled={isLoading}
        className={`flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 ${radiusClass} font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 active:scale-[0.98]`}
      >
        {cancelText}
      </button>
      <button
        onClick={() => {
          triggerHaptic('medium');
          onConfirm();
        }}
        disabled={isLoading}
        className={`flex-1 px-4 py-3 ${config.confirmBg} ${radiusClass} font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : null}
        {confirmText}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<Icon className="w-5 h-5" />}
      iconBg={config.iconBg}
      footer={footer}
    >
      <p className="text-sm text-slate-300 leading-relaxed font-medium">{message}</p>
    </BaseModal>
  );
};

export default ConfirmModal;
