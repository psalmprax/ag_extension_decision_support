import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color?: string;
    radiusClass?: string;
    change?: number;
}

export const MetricCard = ({ title, value, icon: Icon, color = 'blue', radiusClass = 'rounded-xl', change }: MetricCardProps) => (
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
                {change !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold mt-2 ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        <TrendingUp className="w-3 h-3" />
                        <span>{change >= 0 ? '+' : ''}{change}%</span>
                    </div>
                )}
            </div>
            <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/30 ${radiusClass}`}>
                <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
            </div>
        </div>
    </motion.div>
);
