import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { STAT_COLORS } from '@/lib/color-tokens';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
    /** Color name from STAT_COLORS (e.g. 'blue', 'cyan', 'green') */
    color?: string;
    /** Icon component (alternative to icon prop, used with color-based API) */
    Icon?: React.ComponentType<{ className?: string }>;
    /** Legacy API: custom card classes */
    cardClass?: string;
    headingClass?: string;
    dataClass?: string;
    subtextClass?: string;
    isModern?: boolean;
    change?: number;
    delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    color,
    Icon,
    cardClass = '',
    headingClass,
    dataClass,
    subtextClass,
    isModern = false,
}) => {
    // Color-based API (Agents, Telemetry, Memory, etc.)
    // icon can be passed as either Icon (component) or icon (component via lowercase prop)
    const IconComponent = Icon || (typeof icon === 'function' ? icon as React.ComponentType<{ className?: string }> : undefined);
    if (color || IconComponent) {
        const cc = STAT_COLORS[color || 'blue'] || STAT_COLORS.blue;
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 border-white/20 hover:scale-[1.02] transition-transform duration-300"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-premium)' }}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </div>
                    {IconComponent && (
                        <div className={`p-3 ${cc.bg} rounded-xl`}>
                            <IconComponent className={`w-6 h-6 ${cc.icon}`} />
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    // Design-system API (DashboardPage, etc.)
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('p-6 transition-transform duration-300 hover:scale-[1.02]', cardClass)}
        >
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    <p className={cn('text-xs font-bold uppercase tracking-wider mb-1', subtextClass)}>
                        {title}
                    </p>
                    <p className={cn(
                        'text-3xl font-black tracking-tighter',
                        headingClass,
                        isModern ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'
                    )}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className={cn('text-xs mt-1', dataClass)}>
                            {subtitle}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className={cn('p-3 rounded-xl', subtextClass?.replace('text-', 'bg-').replace('600', '50').replace('400', '50'), 'dark:bg-white/5')}>
                        {typeof icon === 'function' ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'w-6 h-6' }) : icon}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default StatCard;
