import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    borderRadius?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = "",
    width = "100%",
    height = "1rem",
    borderRadius = "0.5rem"
}) => {
    return (
        <div
            className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}
            style={{ width, height, borderRadius }}
        >
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-gray-600/20"
                animate={{
                    x: ['-100%', '100%'],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                }}
            />
        </div>
    );
};

export const CardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Skeleton width="40%" height="1.25rem" className="mb-4" />
        <Skeleton width="80%" height="2.5rem" className="mb-2" />
        <Skeleton width="30%" height="1rem" />
    </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
    <div className="space-y-4 w-full">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex space-x-4 items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-50 dark:border-gray-700">
                <Skeleton width="40px" height="40px" borderRadius="100%" />
                <div className="flex-1 space-y-2">
                    <Skeleton width="30%" height="1rem" />
                    <Skeleton width="60%" height="0.75rem" />
                </div>
                <Skeleton width="100px" height="2rem" borderRadius="0.75rem" />
            </div>
        ))}
    </div>
);

export const ListSkeleton = ({ items = 5 }) => (
    <div className="space-y-2 p-2">
        {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <Skeleton width="32px" height="32px" borderRadius="100%" />
                <div className="flex-1 space-y-1">
                    <Skeleton width="60%" height="0.875rem" />
                    <Skeleton width="40%" height="0.75rem" />
                </div>
            </div>
        ))}
    </div>
);

export const ChartSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Skeleton width="30%" height="1.25rem" className="mb-4" />
        <Skeleton width="100%" height="300px" />
    </div>
);

export const MetricCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
            <Skeleton width="40%" height="1rem" />
            <Skeleton width="40px" height="40px" borderRadius="0.75rem" />
        </div>
        <Skeleton width="60%" height="2rem" className="mb-2" />
        <Skeleton width="30%" height="0.75rem" />
    </div>
);

export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    className = ""
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
            {icon && <div className="mb-4 text-gray-400 dark:text-gray-500">{icon}</div>}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">{description}</p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
};
