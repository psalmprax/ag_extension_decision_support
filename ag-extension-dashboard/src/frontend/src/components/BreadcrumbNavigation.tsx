import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface BreadcrumbItem {
    label: string;
    path?: string;
    onClick?: () => void;
}

interface BreadcrumbNavigationProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function BreadcrumbNavigation({ items, className = '' }: BreadcrumbNavigationProps) {
    const { t } = useLanguage();

    if (items.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-sm ${className}`}>
            <button
                onClick={() => items[0]?.onClick?.()}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label={t('nav_home') || 'Home'}
            >
                <Home className="w-4 h-4" />
            </button>

            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    {index === items.length - 1 ? (
                        <span className="font-medium text-gray-900 dark:text-white" aria-current="page">
                            {item.label}
                        </span>
                    ) : (
                        <button
                            onClick={item.onClick}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        >
                            {item.label}
                        </button>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}