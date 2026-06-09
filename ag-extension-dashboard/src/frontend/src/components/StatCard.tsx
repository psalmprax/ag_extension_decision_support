import React from 'react';
import { motion } from 'framer-motion';
import { StatCardProps } from '../types/dashboard';

export const StatCard = ({ title, value, change, icon: Icon, delay, cardClass, headingClass, dataClass, subtextClass, isModern }: StatCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 300, damping: 24 }}
            className={cardClass}
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/5 blur-3xl -mr-12 -mt-12 group-hover:bg-cyan-400/20 transition-all"></div>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 ${isModern ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'} rounded-lg`}>
                    <Icon className="w-5 h-5" />
                </div>
                {change !== undefined && (
                    <span className={`text-xs font-bold ${change >= 0 ? (isModern ? 'text-emerald-600 dark:text-cyan-400' : 'text-emerald-500') : 'text-rose-500'}`}>
                        {change >= 0 ? '+' : ''}{change}%
                    </span>
                )}
            </div>
            <h3 className={`font-headline uppercase mb-1 ${isModern ? headingClass : (subtextClass || 'text-slate-500 dark:text-slate-400')}`}>{title}</h3>
            <div className={`text-3xl font-headline ${dataClass}`}>
                {value !== undefined && value !== null ? value.toLocaleString() : '0'}
            </div>
        </motion.div>
    );
};
