import React from 'react';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { BaseModal } from './BaseModal';

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
    const { btnClass } = useThemeClasses();
    const variants = {
        danger: {
            icon: AlertTriangle,
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            confirmBg: 'bg-red-600 hover:bg-red-700',
        },
        warning: {
            icon: AlertCircle,
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            confirmBg: 'bg-amber-600 hover:bg-amber-700',
        },
        info: {
            icon: Info,
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            confirmBg: 'bg-blue-600 hover:bg-blue-700',
        },
        success: {
            icon: CheckCircle,
            iconBg: 'bg-green-100 dark:bg-green-900/30',
            iconColor: 'text-green-600 dark:text-green-400',
            confirmBg: 'bg-green-600 hover:bg-green-700',
        },
    };

    const config = variants[variant];
    const Icon = config.icon;

    const footer = (
        <div className="flex gap-3">
            <button
                onClick={onClose}
                disabled={isLoading}
                className={`flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold ${btnClass} hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50`}
            >
                {cancelText}
            </button>
            <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2.5 ${config.confirmBg} text-white font-semibold ${btnClass} transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
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
            icon={<Icon className={`w-5 h-5 ${config.iconColor}`} />}
            iconBg={config.iconBg}
            footer={footer}
        >
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>
        </BaseModal>
    );
};

export default ConfirmModal;
