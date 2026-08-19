import React from 'react';
import { motion } from 'framer-motion';
import { StatCardProps } from '../types/dashboard';

export const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  delay,
  cardClass,
  headingClass,
  dataClass,
}: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      className={cardClass}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-400/5 blur-3xl -mr-12 -mt-12 group-hover:bg-primary-400/20 transition-all"></div>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <span
            className={`text-xs font-bold ${change >= 0 ? 'text-emerald-600 dark:text-primary-400' : 'text-rose-500'}`}
          >
            {change >= 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      <h3 className={`font-headline uppercase mb-1 ${headingClass}`}>{title}</h3>
      <div className={`text-3xl font-headline ${dataClass}`}>
        {value !== undefined && value !== null ? value.toLocaleString() : '0'}
      </div>
    </motion.div>
  );
};
