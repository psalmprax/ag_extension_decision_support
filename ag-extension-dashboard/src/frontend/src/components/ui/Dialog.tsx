import React, { Fragment } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { cn } from '@/lib/cn';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
};

export function Dialog({ open, onClose, children, size = 'md' }: DialogProps) {
    return (
        <Transition appear show={open} as={Fragment}>
            <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 scale-95 translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-4"
                        >
                            <HeadlessDialog.Panel
                                className={cn(
                                    'w-full transform overflow-hidden text-left align-middle',
                                    'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10',
                                    'rounded-2xl shadow-2xl',
                                    sizeClasses[size]
                                )}
                            >
                                {children}
                            </HeadlessDialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <HeadlessDialog.Title
            as="h3"
            className={cn('text-lg font-bold text-slate-900 dark:text-white', className)}
            {...props}
        />
    );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <HeadlessDialog.Description
            as="p"
            className={cn('mt-2 text-sm text-slate-500 dark:text-slate-400', className)}
            {...props}
        />
    );
}

export function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('p-6', className)} {...props} />;
}

export function DialogActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10', className)}
            {...props}
        />
    );
}
