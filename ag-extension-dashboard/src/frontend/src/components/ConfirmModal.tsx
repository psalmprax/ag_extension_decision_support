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
      confirmBg: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
    warning: {
      icon: AlertCircle,
      iconBg: 'bg-amber-500/15 border border-amber-500/30 text-amber-400',
      confirmBg: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    info: {
      icon: Info,
      iconBg: 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400',
      confirmBg: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    },
    success: {
      icon: CheckCircle,
      iconBg: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
      confirmBg: 'bg-emerald-600 hover:bg-emerald-500 text-white',
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
        className={`flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 ${radiusClass} font-medium text-xs transition-colors disabled:opacity-50`}
      >
        {cancelText}
      </button>
      <button
        onClick={() => {
          triggerHaptic('medium');
          onConfirm();
        }}
        disabled={isLoading}
        className={`flex-1 px-4 py-2.5 ${config.confirmBg} ${radiusClass} font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm`}
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
