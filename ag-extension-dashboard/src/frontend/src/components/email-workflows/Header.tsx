import React from 'react';
import { RefreshCw } from 'lucide-react';

export function EmailWorkflowsHeader({
    isModern,
    headingClass,
    subtitle,
    isRefreshing,
    onRefresh,
    btnClass,
}: {
    isModern: boolean;
    headingClass: string;
    subtitle: string;
    isRefreshing: boolean;
    onRefresh: () => void;
    btnClass: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Automated Dispatch' : 'Email Workflows'}</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
            </div>
            <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
            >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
            </button>
        </div>
    );
}
