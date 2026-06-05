import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { STAT_COLORS } from '@/lib/color-tokens';

const REACT_ELEMENT_TYPE = Symbol.for('react.element');

/** Check if value is a React component type (function, forwardRef, memo, lazy).
 *  Excludes React elements (which also have $$typeof but cannot be used as types). */
function isComponentType(val: unknown): val is React.ComponentType<{ className?: string }> {
    if (typeof val === 'function') return true;
    if (typeof val === 'object' && val !== null) {
        const $$typeof = (val as Record<string, unknown>).$$typeof;
        return $$typeof !== undefined && $$typeof !== REACT_ELEMENT_TYPE;
    }
    return false;
}

/** Render a component-type icon safely (works with function, forwardRef, memo, and lazy) */
const IconWrapper: React.FC<{ icon: React.ComponentType<{ className?: string }> }> = ({ icon: IconComp }) => (
    <IconComp className="w-6 h-6" />
);

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
    const IconComponent = Icon || (isComponentType(icon) ? icon as React.ComponentType<{ className?: string }> : undefined);
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
                        {isComponentType(icon) ? <IconWrapper icon={icon as React.ComponentType<{ className?: string }>} /> : icon}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default StatCard;
