import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';

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
    const { radiusClass, btnClass } = useDesignSystemMode();
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

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative w-full max-w-md bg-white dark:bg-gray-800 ${radiusClass} shadow-2xl overflow-hidden`}
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 ${radiusClass} ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-6 h-6 ${config.iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className={`p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${btnClass} transition-colors flex-shrink-0`}
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <div className="flex gap-3 mt-6">
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
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;
